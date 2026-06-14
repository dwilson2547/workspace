harley parts website: https://www.harley-davidson.com/us/en/shop/c/motorcycle-service-parts?aribrand=HDM

use the skill located at /home/daniel/documents/workspace/web_scrapers/scraper-development-skill to develop a scraper to pull all harley davidson motorcycle parts

website flow: go to page -> select year -> select model -> select trim -> select system -> see system diagram and parts

output data considerations: I plan to integrate this with another project i have called parts_interchange, the end goal is a reverse lookup for parts so users can find out if a part from a 2012 chevy will work on a 2018 buick for example. that project has the data structured such that there's a car table (year make model trim) and car has car_diagrams as well as car_parts, diagrams has an index to part mapping table as well so i can maintain the full structure while also having a quick global part lookup at the vehicle level. i'd like to keep that same structure here if possible, but the priority is getting the data from this site, we can massage it later if needed. please use the imgcache to store a copy of each image pulled