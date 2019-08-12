import mysql.connector
import logging
import os
from utilities.utils import Utils


logger = logging.getLogger()
logger.setLevel(logging.INFO)

class Load(object):

    def __init__(self, database, table):
        '''
        Initialize the Load Class.
        :param database: Name of the database to get a connection to
        :param table: Name of the table to load data to
        '''
        self.database = database
        self.table = table
        self.conn = self._get_db_conn()

    def _get_db_conn(self):
        '''
        Retrieve a database connection using environment variables
        :return: db_conn: connection client to the database
        '''
        # host='AQICAHhMz1Wf7tTGilIGlJZDb3LaCAXhS5a/i+jj8GeI1TQa6gHQuQO7vW3uvEq6M6eSJZRWAAAAljCBkwYJKoZIhvcNAQcGoIGFMIGCAgEAMH0GCSqGSIb3DQEHATAeBglghkgBZQMEAS4wEQQM/5hbtKGk/bpYfcDpAgEQgFCGmwoxqJoKriZ3QRQLKH/OjtdJhQhzKN7AeRey2snliLdcN401RUu/WfN74QMOmC5dQPF/Qa6tp2MkJFj2nGG0sT7BPiCGvpZcI6/+yxO/7Q=='
        # user='AQICAHhMz1Wf7tTGilIGlJZDb3LaCAXhS5a/i+jj8GeI1TQa6gEbd4oY9yeRBPRVtPEl+aV8AAAAYjBgBgkqhkiG9w0BBwagUzBRAgEAMEwGCSqGSIb3DQEHATAeBglghkgBZQMEAS4wEQQM6YP7mHs0FewhaW0WAgEQgB8xE0OQFJEZEncgtHEap2KURy1iro7i4T46sA+eFcWy'
        # password='AQICAHhMz1Wf7tTGilIGlJZDb3LaCAXhS5a/i+jj8GeI1TQa6gHr01plcfbYdIgjaP8qeKxQAAAAbjBsBgkqhkiG9w0BBwagXzBdAgEAMFgGCSqGSIb3DQEHATAeBglghkgBZQMEAS4wEQQM/a9TjYHJeZITVsFiAgEQgCtHsOIot/7er7vqNlvKuPwsn5i0dHm+vN06f+1JR0UrBuNQz8L8jNofnNEs'
        utils = Utils()
        db_conn = mysql.connector.connect(
            
            
            host=utils.decrypt(os.environ.get('db_url')),
            user=utils.decrypt(os.environ.get('db_user')),
            password=utils.decrypt(os.environ.get('db_password')),
            # host=utils.decrypt(host),
            # user=utils.decrypt(user),
            # password=utils.decrypt(password),
            database=self.database
        )
        
      
        return db_conn

    def _upsert(self, table, dict):
        '''
        The following function creates an UPSERT statement to run against the mysql DB. It adds all of the keys and values in the dict into a list and then formats the list into a string.

        :param table: Table to use in the upsert statement
        :type table: str
        :param dict: dict to unpack into the upsert statement
        :type  dict: dict
        :param double_quotes_list: list of keys that must be wrapped in double quotes when sent to RDS
        :type  double_quotes_list: list
        :return: query: UPSERT query
        :rtype: str
        '''
        keys = ["{}".format(k) for k in dict]
        values = ["'{}'".format(self.conn.converter.escape(v)) for k, v in dict.items()]
        sql = list()
        sql.append("INSERT INTO %s (" % table)
        sql.append(", ".join(keys))
        sql.append(") VALUES (")
        sql.append(", ".join(values))
        sql.append(") ON DUPLICATE KEY UPDATE ")
        updates = ["{} = '{}'".format(k, self.conn.converter.escape(v)) for k, v in dict.items()]
        sql.append(", ".join(updates))
        sql.append(";")
        query = "".join(sql)
        return query

    def send_status_to_db(self, dict_to_db):
        '''
        Function to send an insert status to a table using a DB connection
        :param dict_to_db: dict containing all values to be added to the database.
        :type dict_to_db: dict
        :return: No value to return
        '''

        '''Get the connection with the DB'''
        db_conn = self.conn
        mycursor = db_conn.cursor()

        '''Craft the query by flattening the values in the dict'''
        query = self._upsert(self.table, dict_to_db)

        logger.info('Sending the following update to the database:\n {}'.format(query))

        '''Execute and commit the query'''
        mycursor.execute(query)
        db_conn.commit()
        db_conn.close()
