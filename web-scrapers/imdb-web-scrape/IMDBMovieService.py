from IMDBMovie import IMDBMovie
from DatabaseConnection import DatabaseConnection

class IMDBMovieService:

    tblDefn = "Create Table IMDBMovie (id float AUTO_INCREMENT PRIMARY KEY, name varchar(500), imdb_id int, year int, content_rating varchar(200), length varchar(200), movie_rating varchar(200))"
    dbConnection = None
    select_query = """Select * from IMDBMovie"""
    select_by_id_query = """Select * from IMDBMovie where id = {}"""
    create_query = """INSERT into IMDBMovie (name, imdb_id, year, content_rating, length, movie_rating) VALUES ('{}',{},{},'{}','{}','{}')"""
    update_query = """UPDATE IMDBMovie set name = '{}', imdb_id = {}, year = {}, content_rating = '{}', length = '{}', movie_rating = '{}' WHERE ID = {}"""

    def __init__(self, dbCon):
        self.dbConnection = dbCon

    def map(self, data):
        temp = IMDBMovie(data[0], data[1], data[2], data[3], data[4], data[5], data[6])
        return temp

    def createQuery(self, movie):
        query = """INSERT INTO IMDBMovie ("""
        values = """("""
        if movie.name:
            query = query + 'name,'
            values = values + '"' + movie.name + '",'
        if movie.imdb_id:
            query = query + 'imdb_id,'
            values = values + str(movie.imdb_id) + ","
        if movie.year:
            query = query + 'year,'
            values = values + str(movie.year) + ","
        if movie.content_rating:
            query = query + 'content_rating,'
            values = values + "'" + movie.content_rating + "',"
        if movie.length:
            query = query + 'length,'
            values = values + "'" + movie.length + "',"
        if movie.movie_rating:
            query = query + 'movie_rating,'
            values = values + "'" + movie.movie_rating + "',"
        query = query.rstrip(',') + ') VALUES ' + values.rstrip(',') + ')'
        return query

    def create(self, movie):
        query = self.createQuery(movie)
        return self.dbConnection.insertRow(query)

    def createAndReturn(self, movie):
        query = self.create_query.format(movie.name, movie.imdb_id, movie.year, movie.content_rating, movie.length, movie.movie_rating)
        new_id = self.dbConnection.insertRow(query)
        get_query = self.select_by_id_query.format(new_id)
        return map(self.dbConnection.getOneById(get_query))

    def createTable(self):
        if self.dbConnection.checkTableExists('IMDBMovie') == 0:
            self.dbConnection.createTable(self.tblDefn)
        else:
            print('Not needed')