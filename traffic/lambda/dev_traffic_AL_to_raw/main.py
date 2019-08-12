from extract.extract import Extract
from utilities.utils import  Utils
import logging
import json


def lambda_handler(event, context):
    '''
    Function called by the Lambda Trigger. The way this was created is to delegate tasks to other classes and functions in order to keep the main function lightweight.
    :param event: Event passed in by the lambda trigger
    :type event: dict
    :param context: Context passed in by the lambda trigger
    :return: No value to return
    '''

    try:
        """Initial process flow"""
        param = event['queryStringParameters']
        if param:
            
            """Validate parameters"""
            if "granularity" in param:
                granularity = Extract.validate_granularity(param['granularity'])
            else:
                granularity = 'DAILY'
                
            
            if "usedecimals" in param:
                usedecimals = Extract.validate_usedecimals(param['usedecimals'])
            else:
                usedecimals = 'false'
            
            
            assert granularity.lower() in ['hourly','daily'], "Please validate"
            assert usedecimals.lower() in ['false','true'], "Please validate"
            
            
            """Read the main parameters"""
            lambda_start_time = param['startEpoch']
            lambda_end_time = param['endEpoch']
            tdids = param['tdids']
            Extract(lambda_start_time, lambda_end_time).run(tdids,granularity,usedecimals)
            return {
                "statusCode": 200,
                "body": json.dumps(
                    'Data retrieved successfully from {} to {}!'.format(lambda_start_time, lambda_end_time))
            }
                
        else:
            return {
                    "statusCode": 400,
                    "body": json.dumps(
                        'The request has been sent without parameters, please try again!')
                    }
                
    except Exception as err:
        logger = logging.getLogger()
        logger.setLevel(logging.INFO)
        utils = Utils()
        utils.send_err_email_process(err,'parameters do not satisfy the expected values')
        logger.error('Process failed due to a initial parameters error')
        
        return {
                    "statusCode": 400,
                    "body": json.dumps(
                        'There is a request error on the query parameters, please validate the request and try again.')
                    }

    

