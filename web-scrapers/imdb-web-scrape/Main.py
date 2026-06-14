from DatabaseConnection import DatabaseConnection
from urllib.request import urlopen as uReq
from bs4 import BeautifulSoup as soup
from IMDBMovie import IMDBMovie
from IMDBMovieService import IMDBMovieService

dbCon = DatabaseConnection(None)

def getWebMovieById(id, index):
    try:
        url = 'http://imdb.com/title/tt' + str(id)
        client = uReq(url)
        html = client.read()
        client.close()
        page = soup(html, "html.parser")
        header = page.find('h1', itemprop = 'name')
        if header == None:
            return None
        year = header.find('span')
        movie_year = year.text.strip().lstrip('(').rstrip(')')
        year.decompose()
        movie_name = header.text.strip()
        movie_imdb_id = id
        subtext = page.find('div', {'class': 'subtext'})
        movie_content_rating = None
        movie_length = None
        if subtext:
            time = subtext.find('time')
            if time:
                movie_length = time.text.strip()
            content_rating = subtext.find('meta', itemprop = 'contentRating')
            if content_rating:
                movie_content_rating = content_rating['content'].strip()
        rating = page.find('div', {'class':'ratingValue'})
        movie_rating = None
        if rating:
            movie_rating = rating.text.strip()
        movie = IMDBMovie(0, movie_name, movie_imdb_id, movie_year, movie_content_rating, movie_length, movie_rating)
        return movie
    except:
        if index < 5:
            index = index + 1
            return getWebMovieById(id, index)

movieService = IMDBMovieService(dbCon)
for i in range(1250, 2000):
    if i % 10 == 0:
        print('Working on number: ' + str(i))
    try:
        movie = getWebMovieById(i, 0)
        if movie:
            movieService.create(movie)
        else:
            print('ID SKIPPED: ' + str(i))
    except:
        print('ID BROKEN: ' + str(i))
        continue