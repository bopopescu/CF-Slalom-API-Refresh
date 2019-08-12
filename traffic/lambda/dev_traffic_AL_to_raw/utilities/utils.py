import s3fs
import yaml
import os
import datetime
import json
import boto3
from base64 import b64decode , b64encode
from botocore.exceptions import ClientError
import logging


logger = logging.getLogger()

class Utils(object):
    def __init__(self):
        pass

    @staticmethod
    def get_yaml_config():
        '''
        Function to retrieve configuration values from the YAML file
        :return: config: Configuration values as a dictionary
        :rtype: dict
        '''

        with open('utilities/config.yml') as f:
            config = yaml.safe_load(f)
            return config

    @staticmethod
    def decrypt(encrypted_var):
        '''
        Function to decrypt values with AWS KMS

        :param encrypted_var: variable to encrypt
        :return: decrypted_var: decrypted variable
        '''
        decrypted_var = boto3.client('kms').decrypt(CiphertextBlob=b64decode(encrypted_var))['Plaintext']
        return decrypted_var
        
    @staticmethod
    def encrypt(encrypt_var):
        '''
        Function to encrypt values with AWS KMS

        :param encrypt_var: variable to encrypt
        :return: encrypted_var: encrypted variable
        '''
        encrypted_var = boto3.client('kms').encrypt(
            KeyId='',
            Plaintext=encrypt_var
            )
        
        return b64encode(encrypted_var['CiphertextBlob'])

    @staticmethod
    def concatenate_url(baseurl, extension):
        '''
        Function to concatenate a base URL and the extension
        :param baseurl: base URL that stays consistent
        :type baseurl: str
        :param extension: URL extension
        :type extension: str
        :return: concatenation of baseurl and extension
        :rtype: str
        '''

        return '{}{}'.format(baseurl, extension)

    @staticmethod
    def time_operations_start_end_included(t1, t2):
        '''
        Performs the necessary time operations for crafting our query to our endpoint when given the API trigger. In this function, we take the input value t1 and t2, convert it to datetime and return all values.

        :param t1: input time in epoch ms
        :type t1: int
        :param t2: input time in epoch ms
        :type t2: int
        :returns: t1: t1 in epoch milliseconds
        :rtype: t1: int
        :returns: t2: t2 in epoch milliseconds
        :rtype: t2: int
        :returns: t1_datetime: t1 in datetime format
        :rtype: datetime
        :returns: t2_datetime: t2 in datetime format
        :rtype: datetime
        '''

        t1_epoch = t1/1000
        t2_epoch = t2/1000
        t1_datetime = datetime.datetime.fromtimestamp(t1_epoch)
        t2_datetime = datetime.datetime.fromtimestamp(t2_epoch)
        return t1, t2, t1_datetime, t2_datetime


    @staticmethod
    def time_operations(t1, offset):
        '''
        Performs the necessary time operations for crafting our query to our endpoint when given the S3 trigger. In this function, we take the input value t1, convert it to milliseconds since epoch, and subtract the offset received in the function handler. We convert the offset (min) to milliseconds.
        :param t1: input time
        :type t1: datetime
        :param offset: minutes to offset t1 by
        :type offset: int
        :returns: t1_epoch: t1 in epoch milliseconds
        :rtype: t1_epoch: int
        :returns t1_epoch - offset_ms: t1 minus the offset
        :rtype: int
        :returns: t1_datetime: t1 in datetime format
        :rtype: datetime
        :returns: t2_datetime: t2 in datetime format
        :rtype: datetime
        '''

        '''Format the dates in datetime format'''
        t1_datetime = datetime.datetime.strptime(
            t1, '%Y-%m-%dT%H:%M:%SZ')
        t2_datetime = t1_datetime - datetime.timedelta(minutes=5)

        '''Get the epoch times'''
        t1_epoch = int(t1_datetime.timestamp()*1000)
        offset_ms = offset*60*1000

        return t1_epoch, t1_epoch - offset_ms, t1_datetime, t2_datetime

    @staticmethod
    def json_to_s3(bucket, filename, data):
        '''
        Function that takes JSON data and sends it to S3. The filepath is constructed from the bucket and the filename. The data is send directly to the file.

        :param bucket: S3 bucket to send the file to
        :type bucket: str
        :param filename: Name of the file
        :type  filename str
        :param data: data to input into the file
        :type data: dict
        :return: No value to return
        '''

        s3 = s3fs.S3FileSystem(anon=False)
        filepath = '{}/{}'.format(bucket, filename)
        # Use 'w' for py3, 'wb' for py2
        with s3.open(filepath, 'w') as f:
            f.write(json.dumps(data))

    @staticmethod
    def send_err_email(err, stage, sender, recipients, file, region, **kwargs):
        '''
        Function to send an email to multiple recipients via AWS SES
        :param err: Error to be included
        :type err: str
        :param stage: Stage of the workflow that is failing
        :type stage: str
        :param sender: email address that will be sending the email
        :type sender: str
        :param recipients: list of recipients the email will go to
        :type recipients: str
        :param file: Name of the file that failed to be processed
        :type file: str
        :param region: AWS region used
        :type region: str
        :param kwargs: keyword arguments
        :return: No value to return
        '''
        
        if 'data' in kwargs.keys():
            data = kwargs['data']
        else:
            data = None

        # The subject line for the email.
        SUBJECT = "Lambda Function Error at {}".format(file)

        if data:
            BODY_HTML = """<html>
            <head></head>
            <body>
              <h2>Error occured when calling the Aislelabs API at time: {}</h2>
              <p>Error: {}</p>
              <p>Stage: {}</p>
              <p>Failing Record: {}</p>
              <p>Time: {}</p>
            </body>
            </html>
                        """.format(file, err, stage, data, datetime.datetime.utcnow())
        else:
            BODY_HTML = """<html>
            <head></head>
            <body>
              <h2>Error occured when calling the Aislelabs API at time: {}</h2>
              <p>Error: {}</p>
              <p>Stage: {}</p>
              <p>Time: {}</p>
            </body>
            </html>
                        """.format(file, err, stage, datetime.datetime.utcnow())

        # The character encoding for the email.
        CHARSET = "UTF-8"

        # Create a new SES resource and specify a region.
        client = boto3.client('ses', region_name=region)

        # Try to send the email.
        try:
            # Provide the contents of the email.
            response = client.send_email(
                Destination={
                    'ToAddresses': recipients
                },
                Message={
                    'Body': {
                        'Html': {
                            'Charset': CHARSET,
                            'Data': BODY_HTML,
                        },
                    },
                    'Subject': {
                        'Charset': CHARSET,
                        'Data': SUBJECT,
                    },
                },
                Source=sender,

            )
        # Display an error if something goes wrong.
        except ClientError as e:
            print(e.response['Error']['Message'])
        else:
            print("Email sent! Message ID:"),
            print(response['MessageId'])

    @staticmethod
    def send_err_email_process(err, stage, **kwargs):
        '''
        Function to send an email to multiple recipients via AWS SES
        :param err: Error to be included
        :type err: str
        :param stage: Stage of the workflow that is failing
        :type stage: str
        :param kwargs: keyword arguments
        :return: No value to return
        '''
        
        sender = os.environ['sender']
        recipients = os.environ['recipients'].split(',')
        region = os.environ['aws_region']
        # sender='noreply@cadillacfairview.tech'
        # recipients='mithra.ramesh@slalom.com,andres.urrego@slalom.com'.split(',')
        # region='us-east-1'
        
        if 'data' in kwargs.keys():
            data = kwargs['data']
        else:
            data = None

        # The subject line for the email.
        SUBJECT = "Error: Lambda Function dev_traffic_AL_to_raw"

        if data:
            BODY_HTML = """<html>
            <head></head>
            <body>
              <h2>Error executing the extraction process from Lambda to Aislelabs</h2>
              <p>Error: {}</p>
              <p>Stage: {}</p>
              <p>Failing Record: {}</p>
              <p>Time: {}</p>
            </body>
            </html>
                        """.format(err, stage, data, datetime.datetime.utcnow())
        else:
            BODY_HTML = """<html>
            <head></head>
            <body>
              <h2>Error executing the extraction process from Lambda to Aislelabs</h2>
              <p>Error: {}</p>
              <p>Stage: {}</p>
              <p>Time: {}</p>
            </body>
            </html>
                        """.format(err, stage, datetime.datetime.utcnow())

        # The character encoding for the email.
        CHARSET = "UTF-8"

        # Create a new SES resource and specify a region.
        client = boto3.client('ses', region_name=region)

        # Try to send the email.
        try:
            # Provide the contents of the email.
            response = client.send_email(
                Destination={
                    'ToAddresses': recipients
                },
                Message={
                    'Body': {
                        'Html': {
                            'Charset': CHARSET,
                            'Data': BODY_HTML,
                        },
                    },
                    'Subject': {
                        'Charset': CHARSET,
                        'Data': SUBJECT,
                    },
                },
                Source=sender,

            )
        # Display an error if something goes wrong.
        except ClientError as e:
            print(e.response['Error']['Message'])
        else:
            print("Email sent! Message ID:"),
            print(response['MessageId'])
            