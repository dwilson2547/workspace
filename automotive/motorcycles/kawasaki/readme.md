https://www.kawasaki.com/en-us/owner-center/parts


part diagrams can be found by config starting from here: https://www.kawasaki.com/en-us/owner-center/parts

Goal here is to categorize and persist all kawasaki parts for an interchange lookup 
scraping parts from the web directly will likely be a necessity in this case, i don't have a great source of part pdfs like i had for ducati. after selecting the displacement from the landing page you can select the model, then the year, and then the trim and the next page has all the part categories. when you select a cateogry you get to a page with the diagram and all the parts listed out, i'd like to persist the full bike details from the selector as well as the diagram images and corresponding parts.

General scraper considerations: persist a copy of every page visited in my webcache (web_scrapers/webcache, client code can be found under client/ in the webcache dir). query the cache and use the cached page if possible to parse data from, ovbiously it won't really be that useful for the model year and trim selector pages but i like to be thorrough. the scraper should be generally safe from hard shutdowns, i'd like to persist data at reasonable intervals and build int graceful handling for sigterms or keyboard interrupts. preventing data loss should be a priority. use sqlite as the database with sqlalchemy as the orm. I prefer to scrape slow with a 2-5 second delay between requests, it isn't always necessary but generally speaking a lot of care should be taken to ensure we aren't ddosing the site. we don't want to get ip banned. 

output data considerations: I plan to integrate this with another project i have called parts_interchange, the end goal is a reverse lookup for parts so users can find out if a part from a 2012 chevy will work on a 2018 buick for example. that project has the data structured such that there's a car table (year make model trim) and car has car_diagrams as well as car_parts, diagrams has an index to part mapping table as well so i can maintain the full structure while also having a quick global part lookup at the vehicle level. i'd like to keep that same structure here if possible.

please use the playwright mcp to develop a scraper to persist all part diagrams and parts from this site, maintain a database or status file to keep track of the current position and data pulled, i'm not too fussed whether we scrape the pages and parse later or parse in real time, parsing shouldn't be terrible honestly

create a folder called part_data to store the project data and a further subfolder called images for the downloaded images

you can use the aprilia project as a reference.

while scraping cache as much info as possible so we don't need to re-pull every piece of information on every error