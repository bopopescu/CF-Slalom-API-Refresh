from utilities.utils import Utils
import os
import requests
from requests.adapters import HTTPAdapter
from requests.packages.urllib3.util.retry import Retry
import logging
from load.load_status import Load
from datetime import datetime
import sys
import traceback
import json

logger = logging.getLogger()
logger.setLevel(logging.INFO)

class Extract(object):

    def __init__(self, start_time, end_time):
        '''
        Initialize the Extract Object
        :param start_time: start time of the lambda function or start time entered in the API call
        :type start_time: str
        :param end_time: end time entered in the API call. Defaulted to None as the S3 trigger does not provide an end time
        '''

        self.lambda_start_time = start_time
        self.lambda_end_time = end_time

    def _make_request(self, url, parameters):
        '''
        Make a GET request to the Aislelabs URL with parameters passed into the function
        :param url: URL to call
        :type url: str
        :param parameters: parameters to pass into the request
        :type parameters: dict
        :return: r.json(): json response of the API call
        :rtype: dict
        '''

        session = requests.Session()
        retry = Retry(
            total=5,
            read=5,
            connect=5,
            backoff_factor=1,
            status_forcelist=[500, 502, 503, 504]
        )
        adapter = HTTPAdapter(max_retries=retry)
        session.mount('http://', adapter)
        session.mount('https://', adapter)

        logger.info('Making a call to URL: {}'.format(url))
        logger.info('HTTP call parameters: {}'.format(parameters))

        try:
            r = session.get(url, params=parameters)
            logger.info('Call made to URL: {}'.format(r.url))
            logger.info('Status Code: {}'.format(r.status_code))
            assert r.status_code == 200
            return r.json()

        except:
            return None

    
    
    @staticmethod
    def validate_usedecimals(usedecimals):
        """
        """
        try:
            """Validate and parse useDecimals"""
            decimals = ['false','true']
            if usedecimals:
                if usedecimals in decimals:
                    usedecimals = usedecimals.lower()
                else:
                    usedecimals = 'error'
            else:
                usedecimals = 'false'
        except:
            '''Get the stack trace and print it'''
            err = traceback.format_exc()
            logger.error(err)
            utils = Utils()
            utils.send_err_email_process(err,'parameters not satisfy the expected values')
            
        finally:
            return usedecimals 
            
    @staticmethod
    def validate_granularity(granularity):
        """
        """
        try:
            """Validate and parse granularity"""
            granular_opt = ['hourly','daily']
            if granularity:
                if granularity.lower() in granular_opt:
                    granularity = granularity.upper()
                else:
                    granularity='error'
            else:
                granularity = 'DAILY'
                
        except:
            '''Get the stack trace and print it'''
            err = traceback.format_exc()
            logger.error(err)
            utils = Utils()
            utils.send_err_email_process(err,'parameters not satisfy the expected values')
        
        finally: 
            return granularity 
    
    
    def _craft_request(self, startepoch, endepoch, apikey, tdids,granularity,usedecimals):
        '''
         Function to craft the parameters dictionary that will be passed in the API call.

        :param startepoch: start time of the API call in epoch milliseconds
        :type startepoch: int
        :param endepoch: end time of the API call in epoch milliseconds
        :type endepoch: int
        :param apikey: apikey used to authenticate our requests to the endpoint
        :type apikey: str
        :param orgid: organization ID where the provided swid belongs to
        :param swid: SWID refers to a unique long identifier for all Social WiFi and Connect setup, where the
        end users are displayed a splash page before authenticating to WiFi.
        :return: payload: dict with all of the necessary components to add in the API call
        :rtype: payload: dict
        '''

        logger.debug('StartEpoch: {} ; EndEpoch {}'.format(
            startepoch, endepoch))
        payload = {
            'tdid': tdids,
            'startTime': startepoch,
            'endTime': endepoch,
            'user_key': apikey,
            'granularity' : granularity,
            'useDecimals' : usedecimals
        }
        return payload

    def run(self, tdids, granularity, usedecimals):
        '''
        Function that controls the extraction of data from the Aislelabs endpoint
        :return: No value to return
        '''

        logger.info('Initiating run')

        '''Initiate the Utils'''
        utils = Utils()

        '''Retrieve values from config file'''
        config = utils.get_yaml_config()
        baseurl = config['aislelabs']['baseurl']
        extension = config['aislelabs']['domain']
        bucket = config['aws']['bucket']
        database = config['status_table']['database']
        table = config['status_table']['table']
        

        '''Get the URL'''
        url = utils.concatenate_url(baseurl, extension)

        '''Retrieve values from environment vars'''
        sender = os.environ['sender']
        recipients = os.environ['recipients'].split(',')
        region = os.environ['aws_region']
        # sender = "noreply@cadillacfairview.tech"
        # recipients = "mithra.ramesh@slalom.com"
        # region = 'use-east-1'

        '''Get the api key stored in environment variables and decrypt it'''
        apikey = utils.decrypt(os.environ.get('apikey'))
        #apikey = '3c06767b873c483fc6295fbc7bc421e1'

        '''Get the request parameters and send the the request to the Aislelabs endpoint'''
        try:
            """Set the query datetimes"""
            ts1 = int(self.lambda_start_time)/1000
            ts2 = int(self.lambda_end_time)/1000
            query_start_date = datetime.fromtimestamp(ts1).strftime('%Y-%m-%d %H:%M:%S')
            query_end_date = datetime.fromtimestamp(ts2).strftime('%Y-%m-%d %H:%M:%S')
            
            """Executing HTTP GET request"""
            request_parameters = self._craft_request(
                    self.lambda_start_time, self.lambda_end_time, apikey, tdids, granularity, usedecimals)
            response_json = self._make_request(url, request_parameters)
            
            
            filename_ts = self.lambda_start_time
            filename_end_ts = self.lambda_end_time
            
            '''Create the filename and upload the JSON response to S3 if possible'''
            if granularity.lower() == 'hourly':
                filename = '{}/{}/{}-{}-{}.json'.format('aislelabs', 'hourly-unfiltered-traffic', 
                            'hourly' , filename_ts, filename_end_ts)
            else:
                filename = '{}/{}/{}-{}-{}.json'.format('aislelabs', 'daily-unfiltered-traffic', 
                            'daily' , filename_ts, filename_end_ts)

            if response_json:
                logger.info(
                        'Uploading the file to S3 with the following filepath: {}/{}'.format(bucket, filename))
                utils.json_to_s3(bucket, filename, response_json)

                '''Create a dict to pass to the Load class to send the status to RDS'''
                dict_to_db = {
                        'filename': filename,
                        'tdid': tdids,
                        'query_start_date': query_start_date,
                        'query_end_date': query_end_date,
                        'workflow_step_rds': 1,
                        'date_created': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S'),
                        'date_updated': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S'),
                        'processing_complete_rds': False,
                        'error_rds': False,
                }

                load = Load(database, table)

                load.send_status_to_db(dict_to_db)
            else:
                logger.warning(
                        "We did not receive a successful response back from the endpoint. No file will be uploaded to S3")

                dict_to_db = {
                        'filename': filename,
                        'tdid': tdids,
                        'query_start_date': query_start_date,
                        'query_end_date': query_end_date,
                        'workflow_step_rds': 1,
                        'date_created': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S'),
                        'date_updated': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S'),
                        'processing_complete_rds': True,
                        'error_rds': False,
                }

                load = Load(database, table)

                load.send_status_to_db(dict_to_db)
        except:
            '''Get the stack trace and print it'''
            err = traceback.format_exc()
            logger.error(err)
            utils.send_err_email(err, 'Data retrieval from Aislelabs', sender, recipients, filename_ts,
                                 region)


            '''If we get an error, we still want to send a record to the DB for tracking'''
            dict_to_db = {
                'filename': filename,
                'tdid': tdids,
                'query_start_date': query_start_date,
                'query_end_date': query_end_date,
                'workflow_step_rds': 1,
                'date_created': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S'),
                'date_updated': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S'),
                'processing_complete_rds': False,
                'error_rds': True,
            }

            load = Load(database, table)

            load.send_status_to_db(dict_to_db)
