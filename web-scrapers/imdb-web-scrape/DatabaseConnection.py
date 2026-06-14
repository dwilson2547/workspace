import MySQLdb as sql

class DatabaseConnection:
    ip = ''
    uname = ''
    password = ''
    database = 'WebCrawl'
    charset = 'utf8'
    connection = None
    cursor = None

    def __init__(self, dbName):
        if (dbName):
            self.database = dbName
        self.init()

    def init(self):
        self.connection = sql.connect(self.ip, self.uname, self.password, self.database, charset=self.charset)
        self.cursor = self.connection.cursor()

    def getCursor(self):
        return self.cursor

    def getConnection(self):
        return self.connection

    def getQueryResults(self, query):
        self.cursor.execute(query)
        return self.cursor.fetchall()

    def getOneById(self, query):
        self.cursor.execute(query)
        return self.cursor.fetchone()

    def insertRow(self, query):
        self.cursor.execute(query)
        self.connection.commit()
        return self.cursor.lastrowid

    def toString(self):
        return self.ip + ',' + self.uname + ',' + self.password + ',' + self.database + ',charset=' + self.charset

    def checkTableExists(self, table_name):
        query = """Select * from {} LIMIT 1""".format(table_name)
        try:
            self.cursor.execute(query)
            return 1
        except sql.Error as error:
            errno = str(error).split(',')[0].lstrip('(')
            if errno == '1146':
                return 0
            else:
                return 1

    def createTable(self, tblDefn):
        try:
            self.cursor.execute(tblDefn)
            self.connection.commit()
            return 1
        except Exception as error:
            print(error)
            return 0