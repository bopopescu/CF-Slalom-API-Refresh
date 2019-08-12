from utilities.utils import Utils
from load.load_status import Load
import logging
import pandas
import datetime
import traceback
import sys
import os
import numpy as np

logger = logging.getLogger()
logger.setLevel(logging.INFO)

class Filter(object):

    def __init__(self, bucket, file):
        '''
        Initialization of the Filter class
        :param bucket: bucket from which to retrieve the file
        :param file: name of the file to retrieve and process
        '''

        self.bucket = bucket
        self.file = file

    def _craft_status_filename(self, error=False):
        '''
        Function to modify the filename to indicate if the file was processed or if an error occured. If the error flag is set, we will change the filepath to indicate that it is errored.
        :param error: Flag to determine if there was an error
        :type error: bool
        :return: filename: New file indicating state of processing
        '''

        file_arr = self.file.split('/')
        if not error:
            file_arr.insert(1, 'processed')
        else:
            file_arr.insert(1, 'errored')
            
      
        return '/'.join(file_arr)
        
        
        
    def _craft_output_filename(self, opt_in=True):
        '''
        Function to modify the filename to output to S3 after it has been processed. If the opt-in flag is set, we will modify the filename to include an opt-in-only field. Otherwise, we will include an /all/ component in the name.
        :param opt_in: Flag to determine if we are to add opt-in to the filepath.
        :type opt_in: bool
        :return: filename_output: filename to use
        :rtype: str
        '''

        file_arr = self.file.split('/')
        filename = file_arr[-1].split('.')[0]

        file_arr = file_arr[:2]
        file_arr.append(filename)
        file_arr[-1] = file_arr[-1] + '.csv'
        filename_output = '/'.join(file_arr)
        return filename_output 
        
        
    def _filter_data(self, al_resp):
        '''
        Filter the data in the Aislelabs response and format it into a dataframe
        :param al_resp: response from Aislelabs in JSON format
        :return: dataframe created from the response
        '''
        mydict = {}
        
        for i in range(0, len(al_resp['response'])):
            record = al_resp['response'][i]
            tdid = record['tdid']
    
            for k,v in record['visits'].items():
                arr = []
                arr.append(tdid)
                arr.append(k)
                arr.append(v)
                key = '{}-{}'.format(tdid, k)
                mydict[key] = arr

        df = pandas.DataFrame.from_dict(mydict, orient='index', columns=['TDID', 'Date_Raw', 'Visitors'])
        df.reset_index(inplace=True)
        df['Date'] = pandas.to_datetime(df.Date_Raw.astype(np.int64)/1000, unit='s').dt.strftime('%Y-%m-%d %H:%M:%S').replace({'NaT': None})
        df['DateLocalTime'] = pandas.to_datetime(df.Date_Raw.astype(np.int64)/1000, unit='s').dt.tz_localize('utc').dt.tz_convert('US/Eastern').astype(str).str[:-6]
        df['updatedAt'] = pandas.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')
        df.drop(columns=['index', 'Date_Raw'], axis=1, inplace=True)
        df = df[['Date', 'TDID', 'Visitors', 'updatedAt', 'DateLocalTime']]
        
        return df
            
    

    def run(self):
        logger.info('Starting filtering process')
        '''Initiate the Utils class'''
        utils = Utils()

        '''Retrieve the values from the YAML config file'''
        config = utils.get_yaml_config()
        bucket = config['aws']['bucket']
        originating_bucket = config['aws']['originating_bucket']
        database = config['status_table']['database']
        table = config['status_table']['table']

        '''Retrieve values from environment vars'''
        sender = os.environ['sender']
        recipients = os.environ['recipients'].split(',')
        region = os.environ['aws_region']

        load = Load(database, table)

        try:
            '''Get the json_dict from S3'''
            json_dict = utils.s3_to_json(self.bucket, self.file)

            '''If we have a response from Aislelabs, go ahead and filter the data, push to S3, and then update the status in the database'''
            if json_dict['response']:
                
                df = self._filter_data(json_dict)

                utils.df_to_csv(bucket, self._craft_output_filename(), df)

                dict_to_db = {
                    'filename': self.file,
                    'step_no': 2,
                    'date_updated': datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S'),
                    'processing_complete': False,
                    'error': False
                }

                load.update_status(dict_to_db)

            else:
                '''If we don't have a response, update the status in the database to say that we are stopping processing as there is no data to continue processing. We denote this by setting processing_complete = True'''
                dict_to_db = {
                    'filename': self.file,
                    'step_no': 2,
                    'date_updated': datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S'),
                    'processing_complete': True,
                    'error': False
                }

                load.update_status(dict_to_db)

            '''We then move the file to /processed folder'''
            utils.mv_files(originating_bucket, self.file, self._craft_status_filename())

        except Exception:
            '''If we get an error for the processing of a full file, print the stacktrace, update the status to account to mark the file as failed.
             Then, move the file to an /errored folder '''
            err = traceback.format_exc()
            logger.error(err)
            utils.send_err_email(err, 'Filter Raw to Processed S3 - File Processing', sender, recipients, self.file,
                                 region)

            dict_to_db = {
                'filename': self.file,
                'step_no': 2,
                'date_updated': datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S'),
                'processing_complete': False,
                'error': True
            }

            load.update_status(dict_to_db)

            utils.mv_files(originating_bucket, self.file, self._craft_status_filename(error=True))





