import s3fs
import yaml
import json
import boto3
from base64 import b64decode
import pandas
import datetime
from botocore.exceptions import ClientError



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
    def s3_to_json(bucket, filename):
        '''
        :Function that takes the name of an S3 file and returns it as a Python Dict. The filepath is constructed from the bucket and the filename.

        :param bucket: S3 bucket to retrieve the file from
        :type bucket: str
        :param filename: Name of the file
        :type  filename str
        :return: data: dict with all the contents of the file
        :rtype: dict
        '''

        filepath = '{}/{}'.format(bucket, filename)

        s3 = s3fs.S3FileSystem(anon=False)
        with s3.open(filepath, 'rb') as f:
            data = json.load(f)
        return data

    @staticmethod
    def df_to_csv(bucket, filename, df):
        '''
        :Function that takes a dataframe and sends it to S3 as a csv. The filepath is constructed from the bucket and the filename.
        We send the file to bytes and then upload directly to S3 so that we do not need to write the file to disk before uploading

        :param bucket: S3 bucket to send the file to
        :type bucket: str
        :param filename: Name of the file
        :type  filename str
        :param df: dataframe with all the contents of the file
        :type dataframe
        :return No value to return
        '''

        bytes_to_write = df.to_csv(None, index=False).encode()
        filepath = '{}/{}'.format(bucket, filename)

        s3 = s3fs.S3FileSystem(anon=False)
        with s3.open(filepath, 'wb') as f:
            f.write(bytes_to_write)

    @staticmethod
    def mv_files(bucket, old_filename, new_filename):
        '''
        Function that will move files from one S3 location to another. It is important to note that this function moves files within the same bucket.

        :param bucket: Bucket to move the files within
        :type  bucket: str
        :param old_filename: Old filename of the file
        :param new_filename: New filename to use for the file
        :return: No value to return
        '''

        s3 = s3fs.S3FileSystem(anon=False)
        old_filepath = '{}/{}'.format(bucket, old_filename)
        new_filepath = '{}/{}'.format(bucket, new_filename)
        s3.mv(old_filepath, new_filepath)

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
        SUBJECT = "Lambda Function Error Processing {}".format(file)

        if data:
            BODY_HTML = """<html>
            <head></head>
            <body>
              <h2>Error occured when processing the file: {}</h2>
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
              <h2>Error occured when processing the file: {}</h2>
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
