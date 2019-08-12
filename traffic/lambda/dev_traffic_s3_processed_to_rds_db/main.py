from transform.transform import Transform
#import urllib.parse
import time

def lambda_handler(event, context):
    '''
    Function called by the Lambda Trigger. The way this was created is to delegate tasks to other classes and functions in order to keep the main function lightweight.
    :param event: Event passed in by the lambda trigger
    :type event: dict
    :param context: Context passed in by the lambda trigger
    :return: No value to return
    '''
    time.sleep(5)
    print('Event info:')
    print(event)
    print('\n')

    bucket = event['Records'][0]['s3']['bucket']['name']
    file = event['Records'][0]['s3']['object']['key']
  #  file = urllib.parse.unquote(file)
    Transform(bucket, file).run()

# if __name__ == '__main__':
#     event = {
#           "Records": [
#             {
#               "eventVersion": "2.0",
#               "eventSource": "aws:s3",
#               "awsRegion": "us-east-1",
#               "eventTime": "1970-01-01T00:00:00.000Z",
#               "eventName": "ObjectCreated:Put",
#               "userIdentity": {
#                 "principalId": "EXAMPLE"
#               },
#               "requestParameters": {
#                 "sourceIPAddress": "127.0.0.1"
#               },
#               "responseElements": {
#                 "x-amz-request-id": "EXAMPLE123456789",
#                 "x-amz-id-2": "EXAMPLE123/5678abcdefghijklambdaisawesome/mnopqrstuvwxyzABCDEFGH"
#               },
#               "s3": {
#                 "s3SchemaVersion": "1.0",
#                 "configurationId": "testConfigRule",
#                 "bucket": {
#                   "name": "customerprofile-processed",
#                   "ownerIdentity": {
#                     "principalId": "EXAMPLE"
#                   },
#                   "arn": "arn:aws:s3:::example-bucket"
#                 },
#                 "object": {
#                   "key": "aislelabs/error/all/2019-06-04T15:42:02Z/connectwifiuser-20-2019-06-04T15:42:02Z.csv",
#                   "size": 1024,
#                   "eTag": "0123456789abcdef0123456789abcdef",
#                   "sequencer": "0A1B2C3D4E5F678901"
#                 }
#               }
#             }
#           ]
#         }
#     context = {}
#     lambda_handler(event, context)
