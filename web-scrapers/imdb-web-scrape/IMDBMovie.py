class IMDBMovie:
    id = None
    name = None
    imdb_id = None
    year = None
    content_rating = None
    length = None
    movie_rating = None

    def __init__(self, id, name, imdb_id, year, content_rating, length, movie_rating):
        self.id = id
        self.name = name
        self.imdb_id = imdb_id
        self.year = year
        self.content_rating = content_rating
        self.length = length
        self.movie_rating = movie_rating

    def toString(self):
        return 'id: ' +str(self.id) + ', name: ' + str(self.name) + ', imdb_id: ' + str(self.imdb_id) + ', year: ' + str(self.year) + ', content_rating: ' + str(self.content_rating) + ', length: ' + str(self.length) + ', rating: ' + str(self.movie_rating)