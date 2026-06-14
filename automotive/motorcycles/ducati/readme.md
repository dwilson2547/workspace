Goal here is to categorize and persist all ducati parts for an interchange lookup 
scraping parts from the web directly will be quite difficult i think but part catalogs are very easy to come by, probaby easier to write a scraper for the pdfs than to crawl a website

part manuals can be found here: https://www.ducatiomaha.com/pages/ducati-oem-parts

please use the playwright mcp to develop a scraper to persist all part catalogs from this site, maintain a list or database of which documents have been pulled and when, include a threshold so we don't pull the same document more than once a month

create a folder called part_catalogs to store the downloaded documents, then develop a pdf scraper to extract the parts and subsystems from the catalogs and store them in a database for reverse lookup