import os
import json
import aiohttp
import asyncio
import aiofiles
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import logging

logger = logging.getLogger(__name__)

class ImageFetcher:
    def __init__(self, config_path='config.json'):
        self.config = self._load_config(config_path)
        self.cookie = self._load_cookie()
        self.session = None
        self.concurrent_downloads = 4

    def _load_config(self, config_path):
        try:
            with open(config_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load config: {e}")
            raise

    def _load_cookie(self):
        try:
            with open('cfg_cookie.txt', 'r') as f:
                cookies = [line.strip() for line in f.readlines() if line.strip()]
                return cookies if cookies else None
        except FileNotFoundError:
            logger.warning("cfg_cookie.txt not found")
            return None

    async def _init_session(self):
        if self.cookie:
            # Combine all cookies into a single header
            cookie_header = '; '.join(self.cookie)
            headers = {'Cookie': cookie_header}
            self.session = aiohttp.ClientSession(headers=headers)
        else:
            self.session = aiohttp.ClientSession()

    async def test_cookie(self, url):
        """Test if the current cookie configuration allows access to a URL.
        
        Args:
            url (str): The URL to test access for
            
        Returns:
            bool: True if the URL is accessible, False otherwise
        """
        if not self.session:
            await self._init_session()
        
        try:
            async with self.session.get(url) as response:
                # Check if we got a successful response
                is_success = response.status == 200
                logger.info(f"Cookie test for {url}: {'Success' if is_success else 'Failed'} (Status: {response.status})")
                return is_success
        except Exception as e:
            logger.error(f"Error testing cookie for {url}: {e}")
            return False
        finally:
            if self.session:
                await self.session.close()
                self.session = None

    def test_cookie_sync(self, url):
        return asyncio.run(self.test_cookie(url))

    async def fetch_page(self, url):
        if not self.session:
            await self._init_session()
        
        try:
            async with self.session.get(url) as response:
                return await response.text()
        except Exception as e:
            logger.error(f"Failed to fetch page {url}: {e}")
            return None
        
    async def download_image(self, url, save_path):
        if not self.session:
            await self._init_session()

        try:
            async with self.session.get(url) as response:
                if response.status == 200:
                    async with aiofiles.open(save_path, 'wb') as f:
                        await f.write(await response.read())
                    logger.info(f"Downloaded: {os.path.basename(save_path)}")
                else:
                    logger.error(f"Failed to download {url}: {response.status}")
        except Exception as e:
            logger.error(f"Error downloading {url}: {e}")

    def parse_html(self, html_content):
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Get artist info - use more flexible class selector
        user_info = soup.find('div', class_=lambda x: x and 'user-info' in x)
        artist = user_info.find('h1').find('a').text.strip() if user_info else "unknown_artist"
        print(f"Found artist: {artist}")
        
        # Get album title
        title = soup.find('h2', class_='title')
        album_name = title.text.strip() if title else "unknown_album"
        print(f"Found album: {album_name}")
        
        # Get photo containers
        photos = {}
        for container in soup.find_all('li', class_='photo-container'):
            photo_id = container.get('data-album-photo-id')
            if photo_id:
                print(f"Found photo: {photo_id}")
                link = container.find('a')
                if link and link.get('href'):
                    photos[photo_id] = link['href']
        print(f"Total photos found: {len(photos)}")
        return artist, album_name, photos

    async def download_all_images(self, photos, save_dir):
        os.makedirs(save_dir, exist_ok=True)
        tasks = []
        
        for photo_id, url in photos.items():
            save_path = os.path.join(save_dir, f"{photo_id}.jpg")
            if not os.path.exists(save_path):
                tasks.append(self.download_image(url, save_path))
            
            if len(tasks) >= self.concurrent_downloads:
                await asyncio.gather(*tasks)
                tasks = []
        
        if tasks:
            await asyncio.gather(*tasks)

    async def fetch_page_with_load_more(self, url, offset=0):
        """Get additional gallery data with offset parameter."""
        if not self.session:
            await self._init_session()
        
        load_url = f"{url}{'&' if '?' in url else '?'}partial=true&offset={offset}"
        try:
            async with self.session.get(load_url) as response:
                content = await response.text()
                return None if "No photos available" in content else content
        except Exception as e:
            logger.error(f"Error loading offset {offset} for {url}: {e}")
            return None
        
    async def fetch_gallery_urls(self, url):
        """Get all gallery URLs from artist page."""
        if not self.session or not url.endswith('/photos'):
            return []
            
        # Extract artist name from URL
        artist = url.rstrip('/').split('/')[-2]
        logger.info(f"Fetching galleries for: {artist}")
        
        gallery_links = []
        offset = 0
        
        try:
            # Get initial page
            async with self.session.get(url) as response:
                if response.status != 200:
                    return []
                
                # Process initial page
                soup = BeautifulSoup(await response.text(), 'html.parser')
                for section in soup.find_all('section', class_='image-section'):
                    if link := section.find('a'):
                        if href := link.get('href'):
                            gallery_links.append(href)
                
                # Get additional pages
                while True:
                    offset += 9
                    if not (content := await self.fetch_page_with_load_more(url, offset)):
                        break
                        
                    soup = BeautifulSoup(content, 'html.parser')
                    for section in soup.find_all('section', class_='image-section'):
                        if link := section.find('a'):
                            if href := link.get('href'):
                                gallery_links.append(href)
        except Exception as e:
            logger.error(f"Error fetching galleries for {url}: {e}")
            
        # Add base domain to links
        base_url = url.split('/')[0] + '//' + url.split('/')[2]
        return [urljoin(base_url, link) for link in gallery_links]

    async def fetch_images(self, url):
        """Download images from a URL (gallery or artist page)."""
        if not self.config.get('download_root'):
            return False
        
        # Handle artist page
        if url.endswith('/photos') or url.endswith('/photos/'):
            url = url.rstrip('/')
            try:
                if galleries := await self.fetch_gallery_urls(url):
                    logger.info(f"Found {len(galleries)} galleries")
                    for gallery in galleries:
                        await self.fetch_images(gallery)
                    return True
                return False
            finally:
                if self.session:
                    await self.session.close()
                    self.session = None

        # Handle gallery page
        try:
            if not (html := await self.fetch_page(url)):
                return False

            artist, album, photos = self.parse_html(html)
            if not photos:
                return False

            # Clean names for filesystem
            artist = ''.join(c for c in artist if c.isalnum() or c in ' -_')
            album = ''.join(c for c in album if c.isalnum() or c in ' -_')
            
            await self.download_all_images(photos, os.path.join(self.config['download_root'], artist, album))
            return True
        except Exception as e:
            logger.error(f"Error processing gallery {url}: {e}")
            return False 