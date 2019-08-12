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
        :param conn: connection to the database
        '''
        self.database = database
        self.table = table
        self.conn = self._get_db_conn()

    def _get_db_conn(self):
        '''
        Retrieve a database connection using environment variables
        :return: db_conn: connection client to the database
        '''

        utils = Utils()
        db_conn = mysql.connector.connect(
            # host=os.environ.get('db_url'),
            # user=os.environ.get('db_user'),
            # password=os.environ.get('db_password'),
            # database=self.database
            
            host=utils.decrypt(os.environ.get('db_url')),
            user=utils.decrypt(os.environ.get('db_user')),
            password=utils.decrypt(os.environ.get('db_password')),
            database=self.database
            
            # host= "domoloaderdb-cluster.cluster-caownc2zslkw.us-east-2.rds.amazonaws.com",
            # user="domo",
            # password="CFdomo!loader*_*",
            # database="domoloader"
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
        updates = ["{} = '{}'".format(k,self.conn.converter.escape(v)) for k, v in dict.items()]
        sql.append(", ".join(updates))
        sql.append(";")
        query = "".join(sql)
        print(query)
        return query

    def send_status_to_db(self, dict_to_db):
        '''
        Function to send an insert status to a table using a DB connection
        :param dict_to_db: dict containing all values to be added to the database.
        :type dict_to_db: dict
        :return: No value to return
        '''

        db_conn = self.conn
        mycursor = db_conn.cursor()

        query = """
                INSERT INTO {} ({})
                VALUES {}
                """.format(self.table, ', '.join(list(dict_to_db.keys())), tuple(dict_to_db.values()))

        logger.info('Sending the following update to the database:\n {}'.format(query))

        mycursor.execute(query)
        db_conn.commit()

    def send_data_to_db(self, dict_to_db):
        '''
        Function to send data to a table in RDS.
        :param dict_to_db: dict containing all values to be added to the database.
        :type dict_to_db: dict
        :param double_quotes_list: list of keys that must be wrapped in double quotes when sent to RDS
        :type  double_quotes_list: list
        :return: No value to return
        '''

        db_conn = self.conn
        mycursor = db_conn.cursor()

        query = self._upsert(self.table, dict_to_db)

        mycursor.execute(query)
        db_conn.commit()


    def update_status(self, dict_to_db):
        '''
        Function to send an update to status to a table using a DB connection
        :param dict_to_db: dict containing all values to be added to the database.
        :type dict_to_db: dict
        :return: No value to return
        '''

        db_conn = self.conn
        mycursor = db_conn.cursor()

        query = """
        UPDATE {}
        SET workflow_step_rds = {}, date_updated = '{}', processing_complete_rds = {}, error_rds = {}
        WHERE filename = '{}'""".format(self.table, dict_to_db['step_no'], dict_to_db['date_updated'], dict_to_db['processing_complete'], dict_to_db['error'], dict_to_db['filename'])

        logger.info('Sending the following update to the database:\n {}'.format(query))

        mycursor.execute(query)
        db_conn.commit()
