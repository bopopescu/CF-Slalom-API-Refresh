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

    def _get_db_conn(self):
        '''
        Retrieve a database connection using environment variables
        :return: db_conn: connection client to the database
        '''

        utils = Utils()
        db_conn = mysql.connector.connect(
            host=utils.decrypt(os.environ.get('db_url')),
            user=utils.decrypt(os.environ.get('db_user')),
            password=utils.decrypt(os.environ.get('db_password')),
            database=self.database
        )
        return db_conn

    def send_status_to_db(self, dict_to_db):
        '''
        Function to send an insert status to a table using a DB connection
        :param dict_to_db: dict containing all values to be added to the database.
        :type dict_to_db: dict
        :return: No value to return
        '''

        db_conn = self._get_db_conn()
        mycursor = db_conn.cursor()

        query = """
                INSERT INTO {} ({})
                VALUES {}
                """.format(self.table, ', '.join(list(dict_to_db.keys())), tuple(dict_to_db.values()))

        logger.info('Sending the following update to the database:\n {}'.format(query))

        mycursor.execute(query)
        db_conn.commit()

    def update_status(self, dict_to_db):
        '''
        Function to send an update to status to a table using a DB connection
        :param dict_to_db: dict containing all values to be added to the database.
        :type dict_to_db: dict
        :return: No value to return
        '''

        db_conn = self._get_db_conn()
        mycursor = db_conn.cursor()

        query = """
        UPDATE {}
        SET workflow_step_rds = {}, date_updated = '{}', processing_complete_rds = {}, error_rds = {} WHERE filename = '{}'""".format(self.table, dict_to_db['step_no'], dict_to_db['date_updated'], dict_to_db['processing_complete'], dict_to_db['error'], dict_to_db['filename'])

        #print(query)

        logger.info('Sending the following update to the database:\n {}'.format(query))

        mycursor.execute(query)
        db_conn.commit()
