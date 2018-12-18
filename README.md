# DHMG
### Digitalhigh's Multimedia Gallery

#### What is this?

This is a small (156k) PHP application that can turn any directory of media into a full-blown gallery. No work required (almost), just drop it into a folder structure with some media...and go!

#### Why do you say (almost) no work required?

Because you still need to have a working PHP webserver set up, and you will need to have FFMPEG installed for thumbnail generation from videos.

#### Why would you even do such a thing?

Because other PHP projects that try to be an AIO gallery didn't do all the things I wanted out of a personal media page...so I wrote one.

#### So what makes this better?

Well, IDK about better...but here's some of the things it can do:

1. On-the-fly generation of video/image thumbnails - meaning minimal load times, even on the first time loading a page.
2. Smart caching. Directories are automatically updated and re-scanned when changes are detected. Just add new media and refresh.
3. Custom file name/type filters. Choose to enable/disable files, videos, or images.
4. Automatic detection of all video/image formats supported natively in HTML5.
5. MOBILE FRIENDLY. Responsive UI, fullscreen controls, touch/zoom/pan support.
6. Scroll position tracking - saves your place in the page when navigatin back/forth in the tree.
7. Sort by date/name - Change media display order via the UI - sort orders are retained between reloads/navigation.
8. FAVORITES - Click the star icon on the thumbnail to pin it at the top of the display order. Favorites are sorted independently of non-favorite media, but still based on UI selection.
9. FILTERING - Filter media items by title.
10. Modern - Uses bootstrap and jquery to provide a fast, intelligent, and beautiful way to view and share your media.
11. File downloads - If a file isn't a supported media type, you can still download it, or let others download files. ;)
12. Smart auto-play - Only auto play videos if already playing and cycling to the next media item.
13. Sexy loading animations and stuff. Well, there's really just the one.


### Notes, thoughts, etc...

1. Check the top of index.php for some basic configuration options. You can set the gallery title, thumb size, and which files to show
2. FFMPEG. Install it. Make sure you can access it from a command prompt.
3. This needs the GD library in PHP, as well as CURL. I *think* that's it.
4. I have hooks for audio...but no audio player (yet). IDK if I'll do this, as I don't have a need.
5. Slide animations are a little janky yet. Need to work on that.
6. I may add a flag to auto-play videos...IDK...I prefer to not have them start right away.
7. I just wrote this for me, so please don't get mad if stuff goes wonky. This is not a full-time project, so I'm not likely to respond to issues, etc. Pull requests are always welcome.