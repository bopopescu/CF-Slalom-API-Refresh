from utilities.utils import Utils
from load.load import Load
import logging
import pandas
import datetime
import traceback
import sys
import hashlib
import os

logger = logging.getLogger()
logger.setLevel(logging.INFO)

class Transform(object):

    def __init__(self, bucket, file):
        '''
        Initialization of the transform class
        :param bucket: bucket from which to retrieve the file
        :param file: name of the file to retrieve and process
        '''

        self.bucket = bucket
        self.file = file

    @classmethod
    def _change_column_names(self, df, map):
        '''
        Function to change column names in the dataframe
        :param df: Dataframe
        :type df: dataframe
        :param map: python dict that maps current column values to their desired values
        :type map: dict
        :return: df: dataframe with changed column names
        '''

        df.rename(index=str, columns=map, inplace=True)
        return df

    def _retrieve_filename(self):
        '''
        Function to retrieve the filename that is used in the status table. We derive the filename from the file passed in the __init__ function.
        :return: Filename included in the status table
        '''

        file_arr = self.file.split('/')
        new_file = file_arr[-1]
        new_file2 = new_file.split('.')
        filename = new_file2[0] + '.json'
        file_arr = file_arr[:2]
        file_arr.append(filename)
        fp = '/'.join(file_arr)
        return fp

    def _craft_output_filename(self, error=False):
        '''
        Function to modify the filename to indicate if the file was processed or if an error occured. If the error flag is set, we will change the filepath to indicate that it is errored.
        :param error: Flag to determine if there was an error
        :type error: bool
        :return: filename: New file indicating state of processing
        '''
        file_arr = self.file.split('/')
        if error:
            file_arr.insert(1, 'errored')
        else:
            file_arr.insert(1, 'processed')
        filename = '/'.join(file_arr)
        return filename
        
    def _determine_type(self):
        file_array = self.file.split('/')
        file_array = file_array[-1].split('.')[0]
        file_array = file_array.split('-')
        file_array = file_array[0]
        return file_array
        

    def run(self):
        '''
        Function that controls the workflow and processes the input file
        :return: No value to return
        '''

        logger.info('Starting Function Run')

        '''Initiate the Utils class'''
        utils = Utils()

        '''Retrieve the values from the YAML config file'''
        config = utils.get_yaml_config()
        column_name_map = config['column_name_mapping']
        database_data = config['data_table']['database']
        table_data_daily = config['data_table']['table_daily']
        table_data_hourly = config['data_table']['table_hourly']   
        database_status = config['status_table']['database']
        table_status = config['status_table']['table']

        '''Retrieve values from environment vars'''
        sender = os.environ['sender']
        recipients = os.environ['recipients'].split(',')
        region = os.environ['aws_region']
        
        # sender = "noreply@cadillacfairview.tech"
        # recipients = ["mithra.ramesh@slalom.com"]
        # region = "us-east-1"

        '''Create two Load classes - one to load the data table and another to load the status table'''
        load_status = Load(database_status, table_status)
        
        
        load_type = self._determine_type()
        
        if load_type == 'hourly':
            load_data = Load(database_data, table_data_hourly)
        else:
            load_data = Load(database_data, table_data_daily)


        '''Retrieve the filename that the Aislelabs data came from in order to update the status table'''
        filename = self._retrieve_filename()

        try:
            '''Retrieve the csv from S3 and convert it into a dataframe. Then, change the column names and replace numpy.nan with None'''
            df = utils.s3_to_df(self.bucket, self.file)
            df = self._change_column_names(df, column_name_map)
            df.replace({pandas.np.nan: None}, inplace=True)

          

            '''Transform the dataframe to a dict'''
            records = df.to_dict(orient='records')

            '''Loop through the dict and send the data to the database '''
            for record in records:
                try:
                    load_data.send_data_to_db(record)
                except Exception:
                    '''If we get an error for an individual record, print the stacktrace'''
                    err = traceback.format_exc()
                    logger.error(err)
                    print(err)
                    utils.send_err_email(err, 'Load to RDS - Upsert', sender, recipients, self.file, region,
                                         data=record)

            '''After all the records have been sent to the database, send an update to the status for the file'''
            dict_to_db = {
                'filename': filename,
                'step_no': 3,
                'date_updated': datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S'),
                'processing_complete': True,
                'error': False
            }

            load_status.update_status(dict_to_db)
            '''Then move the file to a /processed folder'''
            utils.mv_files(self.bucket, self.file, self._craft_output_filename())

        except:
            '''If we get an error for the processing of a full file, print the stacktrace, update the status to account to mark the file as failed. Then, move the file to an /errored folder '''

            err = traceback.format_exc()
            logger.error(err)
            utils.send_err_email(err, 'Load to RDS - File Processing', sender, recipients, self.file, region)

            dict_to_db = {
                'filename': filename,
                'step_no': 3,
                'date_updated': datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S'),
                'processing_complete': False,
                'error': True
            }

            load_status.update_status(dict_to_db)

            utils.mv_files(self.bucket, self.file, self._craft_output_filename(error=True))














