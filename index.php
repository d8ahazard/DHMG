<?php
/*

Digitalhigh's Multimedia Gallery 1.0.0

Released: January 1, 2019
by Digitalhigh

*/

if (file_exists("./_sort/sort.php")) require_once("./_sort/sort.php");

//	----------- CONFIGURATION START ------------
$ds = DIRECTORY_SEPARATOR;
$root = "." . $ds;
define('GALLERY_ROOT', $root);
define('DATA_ROOT', ".${ds}_dhmg_data${ds}");
$logPath = DATA_ROOT . "logs${ds}";
DEFINE('LOG_PATH', $logPath);
define('GALLERY_NAME', 'Pocket Gallery');
define('FFMPEG_PATH', 'D:\xampp\ffmpeg.exe');

// Protection schtuff...
define('SECURITY_PHRASE', 'lcZNUIYTbYe4mHofqjTfdtbfqmxe4w'); // Auto generated
define('PASSWORD', ''); // Set this for login stuff (WIP)

define('ENCRYPT_LINKS', false); // Encrypt links with the security phrase
define('PROTECT_LINKS', false); // No direct links to media in gallery (slower)

define('EXCLUDE_ARRAY', [ // Add files here to ignore in listing
        "_dhmg_data",
        "_sort",
        '_dirData',
        "_dirList",
        '_resources',
        '@eaDir',
        '.idea',
        'img',
        'logs',
        '.php',
        '.txt',
        '.sell',
        '.db',
        '.json',
        '.js',
        '.css',
        '.html',
        '.ico',
        '.bk',
        '.htaccess'
    ]
);

define('SHOW_VIDEOS', true);
define('SHOW_FILES', true);

define('THUMB_SIZE', 350);

//	----------- CONFIGURATION END ------------

error_reporting(E_ALL);
ini_set('max_execution_time', 0);
ini_set('memory_limit', -1);
set_time_limit(0);
ini_set("log_errors", 1);
$ds = DIRECTORY_SEPARATOR;
ini_set("error_log", LOG_PATH . "Error.log.php");

mkDirs(DATA_ROOT . 'logs');
mkDirs(DATA_ROOT . 'thumb');
mkDirs(DATA_ROOT . 'info');

_initialize();

function _initialize() {
	write_log("----------------- NEW REQUEST -----------------", "INFO");
	if (SECURITY_PHRASE === '') {
		if ($sc = @file_get_contents($_SERVER['SCRIPT_FILENAME'])) {
			$phrase = randomKey(30);
			$nr_replace = 0;
			$sc = str_replace("define('SECURITY" . "_PHRASE', '');", "define('SECURITY_PHRASE', '$phrase');", $sc, $nr_replace);
			if ($nr_replace === 1) {
				if (file_put_contents($_SERVER['SCRIPT_FILENAME'], $sc)) {
					header('Location: ' . $_SERVER['PHP_SELF']);
					xit();
				}
			}
		}
		xit('You have to set the SECURITY_PHRASE in the top of the script! See readme.txt for description.');
	}

	$path = GALLERY_ROOT;
	$itemId = $_GET['id'] ?? false;

	if ($itemId) {
	    write_log("We have an item id: $itemId");
		$path = stringUrl($itemId);
		$cmd = $_GET['cmd'] ?? false;
		if ($cmd) {
			write_log("Received a $cmd request for: $itemId");
			if ($cmd === 'json') {
			    $background = $_GET['background'] ?? false;
				header('Content-Type: application/json');
				$json = dirJson($path, $background);
				echo json_encode($json);
				xit();
			}

			$target = $_GET['target'] ?? false;
			$target = $target ? stringUrl($target) : false;
			if ($cmd === 'addFav' && $target) {
			    write_log("We should add a favorite here.");
			    $data = setFavorite($itemId, $target);
				header('Content-Type: application/json');
			    echo json_encode(dirJson($path, false, $data));
			    xit();
            }

            if ($cmd === 'delFav' && $target) {
                write_log("We should remove a favorite here.");
                $data = setFavorite($itemId, $target, true);
                header('Content-Type: application/json');
                echo json_encode(dirJson($path, false, $data));
                xit();
            }

			if ($cmd == 'thumb') {
				$path = getThumb($path, false);
				if (file_exists($path)) {
					$ext = fileId($path, true);
					$name = basename($path);
					header('Content-Type: image/' . $ext);
					header("Content-Disposition: filename='$name'");
					readfile($path);
				}
				die();
			}

			if ($cmd === 'image' || $cmd === 'img') {
				if (file_exists($path)) {
					$ext = fileId($path, true);
					$name = basename($path);
					write_log("File is valid, setting ext to $ext and name to $name. ");
					header('Content-Type: image/' . $ext);
					header("Content-Disposition: filename='$name'");
					readfile($path);
				}
				xit();
			}

			if ($cmd == 'video') {
			    $id = fileId($path, true);
                header('Content-Type: text/plain');
                echo $path;

				xit("file ID: $id");
			}

			if ($cmd == 'file') {
				header('Location: ' . $path);
				xit();
			}
			xit();
		} else {
			write_log("No command, echoing body...");
		}
	} else {
	    $itemId = "." . DIRECTORY_SEPARATOR;
	}
	define("DIR_KEY", $itemId);
	$paths = makeLinks($path);
	$lines = [];
	$i = 0;
	foreach($paths as $path) {
	    $link = $i ? (".?id=" . $path['link']) : ".";
		$name = $i ? ucwords($path['name']) : "Home";
		if ($i === (count($paths) - 1)) {
		    $active = " active";
		    $inner = $name;
        } else {
		    $active = "";
		    $inner = "<a href='$link'>$name</a>";
        };
		$lines[] = "<li class='breadcrumb-item${active}' aria-current='page'>$inner</li>";
		$i++;
	}
	$header = implode(PHP_EOL, $lines);
	write_log("Paths are: ".json_encode($paths));
	$dirKey = array_pop($paths);

	define("DIR_HEADER", $header);

	write_log("Returning body, dirkey is !!" . $dirKey['link']);
}


function cleanFolders($dir) {
    $ds = DIRECTORY_SEPARATOR;
    $infoRoot = DATA_ROOT . 'info' . $ds;
	$thumbRoot = DATA_ROOT . 'thumb' . $ds;
    $infoPath = str_replace(GALLERY_ROOT, $infoRoot, $dir);
	$existing = glob($infoPath . $ds . '*', GLOB_ONLYDIR);
	$current = glob($dir . $ds . "*", GLOB_ONLYDIR);
	foreach($existing as &$local) {
		$local = str_replace($infoPath, GALLERY_ROOT, localPath($local));
	}
	foreach($current as &$curr) $curr = localPath($curr);
	$diff = array_diff($existing, $current);
	write_log("Diff: ".json_encode($diff));
	if (empty($diff)) write_log("No files to clean!");
	$unlink = [];
    foreach($diff as $clean) {
	    $infoPath = str_replace(GALLERY_ROOT, $infoRoot, $clean);
	    $thumbPath = str_replace(GALLERY_ROOT, $thumbRoot, $clean);
	    $unlink[] = $infoPath;
	    $unlink[] = $thumbPath;
    }
    foreach($unlink as $un) {
        if ($un !== $dir && (preg_match("#info#", $un) || preg_match("#thumb#", $un))) {
	        //write_log("About to unlink $un");
	        //rmdirs($un);
        }
    }
}


function curlQuick($url) {
    write_log("Quick curl fired for $url");
	$ch = curl_init($url);
	//curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
	curl_setopt($ch, CURLOPT_USERAGENT, 'api');
	curl_setopt($ch, CURLOPT_TIMEOUT, 1);
	curl_setopt($ch, CURLOPT_HEADER, 0);
	curl_setopt($ch,  CURLOPT_RETURNTRANSFER, false);
	curl_setopt($ch, CURLOPT_FORBID_REUSE, true);
	curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 1);
	curl_setopt($ch, CURLOPT_DNS_CACHE_TIMEOUT, 10);
	curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

	curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);

	curl_setopt($ch, CURLOPT_FRESH_CONNECT, true);
	$res = curl_exec($ch);
	curl_close($ch);
	write_log("Curl result: ".$res);
//	curl_setopt($ch, CURLOPT_URL, $url);
//	curl_setopt($ch, CURLOPT_RETURNTRANSFER, 0);
//	curl_setopt($ch, CURLOPT_TIMEOUT_MS, 1);
//	curl_exec($ch);
//	curl_close($ch);
	write_log("Curlquick done...");
}


function displayName($name) {
	$name = pathinfo($name, PATHINFO_FILENAME);
	$name = str_replace('_', ' ', $name);
	return ucwords(explode(".", $name)[0]);
}


function dirInfo($dir) {
	$galPath = GALLERY_ROOT;
	$dataPath = DATA_ROOT . "info" . DIRECTORY_SEPARATOR;
	$targetPath = str_replace($galPath, $dataPath, $dir);
	$dataFile = $targetPath . DIRECTORY_SEPARATOR . '_dirData';
	$existing = json_decode(file_get_contents($dataFile), true);
	$curTime = getTime($dir);
	$lastTime = $existing['time'] ?? false;
	$newTime = ($curTime !== ($existing['time'] ?? 'foo'));
	if ($newTime) {
		write_log("Difference caused update: $curTime, $lastTime, writing to $dataFile", "ALERT");
		$newInfo = getDirInfo($dir);
		if ($dir !== $dataFile) putFile($dataFile, $newInfo);
	} else {
		$newInfo = $existing;
	}
	return $newInfo;
}


function dirJson($dir, $background = false, $json = false) {
	write_log("Fetching json for $dir, background is $background", "ALERT");
	$data = $json ? $json : listDirectory($dir, false, $background);
	if (($data[0] ?? 'foo') === 'building') {
	    return $data;
    }
    $favorites = $data['favorites'] ?? [];
	write_log("Favorite array for file: ".json_encode($favorites));
	$results = [];
	$results['media'] = [];
	unset($data['path']);
	unset($data['favorites']);
	foreach($data as $type => $items) {
		if (!is_array($items)) continue;
		foreach ($items as $item) {
			$path = $item['path'];
			$name = displayName($item['name']);
			$link = urlString($path);
			if ($type === 'dir') {
				$info = dirInfo($path);
				$thumb = $info['thumb'] ?? false;
			} else {
				$info = fileInfo($path);
				$thumb = getThumb($path);
			}

			$results['media'][] = [
				'name' => $name,
				'type' => $type,
				'info' => $info,
				'thumb' => urlString($thumb),
				'link' => $link,
                'favorite' => (in_array($path, $favorites))
			];
		}
	}
	return $results;
}


function fileId($file, $returnType = false) {
    $parts = explode(".", $file);
	$type = strtolower(array_pop($parts));
	$image_types = ['jpg', 'jpeg', 'png', 'gif'];
	$video_types = ['mp4', 'mov', 'mkv', 'm4v', 'webm'];
	$audio_types = ['mp3', 'wav', 'ogg'];
	if (in_array($type, $image_types)) {
		if ($type === 'jpg') $type = 'jpeg';
		return $returnType ? $type : 'img';
	} elseif (in_array($type, $video_types)) {
		return $returnType ? $type : 'vid';
	} elseif (in_array($type, $audio_types)) {
		return $returnType ? $type : 'aud';
	} else {
		return $returnType ? $type : 'file';
	}
}


function fileInfo($file) {
    $galPath = GALLERY_ROOT;
	$dataPath = DATA_ROOT . "info" . DIRECTORY_SEPARATOR;
	$dataFile = str_replace($galPath, $dataPath, $file) . '.info';
	$existing = json_decode(file_get_contents($dataFile), true);
	$curTime = getTime($file);
	$curSize = filesize($file);
	$newSize = ($curTime !== ($existing['time'] ?? 'foo'));
	$newTime = ($curSize !== ($existing['size'] ?? 'foo'));
	if ($newSize || $newTime) {
		write_log("Setting file info for $file, targeting $dataFile");
		$data = ['time' => $curTime, 'size' => $curSize];
		if ($file !== $dataFile) putFile($dataFile, $data);
	} else {
		$data = $existing;
	}
	return $data;
}


function filterFile($file) {
	foreach(EXCLUDE_ARRAY as $exclude) {
		if (preg_match("#$exclude#", $file['name'])) return false;
	}
	switch($file['type']) {
		case 'vid':
			write_log("Returning " . SHOW_VIDEOS);
			return SHOW_VIDEOS;
		case 'file':
			return SHOW_FILES;
		default:
			return true;
	}
}


function getDirInfo($dir, $thumbOnly = false) {
	write_log("Function fired for $dir");
	$dirData = listDirectory($dir, $thumbOnly);
	$thumb = false;
	$dir = $dirData['path'];
	$images = $dirData['img'] ?? [];
	$videos = $dirData['vid'] ?? [];
	$dirs = $dirData['dir'] ?? [];
	$tracks = $dirData['aud'] ?? [];
	$files = $dirData['file'] ?? [];
	if (isset($images[0])) {
		$thumb = getThumb($images[0]['path']);
	} elseif (isset($videos[0]) && !$thumb) {
		$thumb = getThumb($videos[0]['path']);
	} elseif (!$thumb) {
		$thumb = false;
		$i = 0;
		foreach ($dirs as $subdir) {
			$subPath = $subdir['path'];
			write_log("Looping subdir for a thumb from $subPath.");
			$thumb = getDirInfo($subPath, true);
			if ($thumb) break;
			$i++;
		}
	}

	if ($thumbOnly) {
		return $thumb;
	} else {
		$dirTime = getTime($dir);
		return [
			'time' => $dirTime,
			'dirs' => count($dirs),
			'images' => count($images),
			'videos' => count($videos),
			'files' => count($files),
			'tracks' => count($tracks),
			'thumb' => $thumb
		];
	}
}


function getCaller() {
	$trace = debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS);
	$callers = [];
	foreach ($trace as $event) {
		if ($event['function'] !== "write_log" &&
			$event['function'] !== "getCaller" &&
			$event['function'] !== "initialize" &&
			$event['function'] !== "analyzeRequest") array_push($callers, $event['function']);
	}
	$info = join(":", array_reverse($callers));
	return $info;
}


function getTime($item) {
	$item = realpath($item);
	if (is_file($item)) return filemtime($item);
	if (is_dir($item)) return filemtime($item . DIRECTORY_SEPARATOR . ".");
	return false;
}


function getThumb($resource, $thumbOnly = true) {
	$image_type = fileId($resource);
	if ($image_type !== 'vid' && $image_type !== 'img') return false;
    $resource = trim($resource);
	$dataPath = trim(DATA_ROOT . 'thumb' . DIRECTORY_SEPARATOR);
	$foo = str_replace($dataPath, GALLERY_ROOT, $resource);
	if ($foo !== $resource) {
	    $resource = $foo;
		$resource = substr($resource, 0, -4);
		$image_type = fileId($resource);
	}
	$thumbPath = str_replace(GALLERY_ROOT, $dataPath, $resource) . ".png";
	$thumbPath = str_replace("//", DIRECTORY_SEPARATOR, $thumbPath);
    if (file_exists($thumbPath)) {
        return $thumbPath;
	} else {
		write_log("Constructing thumb for '$resource', couldn't find it at '$thumbPath'");
		$newWidth = THUMB_SIZE;
		$newHeight = THUMB_SIZE;
		mkDirs(dirname($thumbPath));

		if ($image_type === 'vid') {
			write_log("Got us a thumb request for a video!", "ALERT");
			if ($thumbOnly) return $thumbPath;
			$fullPath = str_replace(GALLERY_ROOT, realpath(GALLERY_ROOT) . DIRECTORY_SEPARATOR, $thumbPath);
			if (!imageVid($resource, $fullPath, $newWidth, $newHeight)) {
				write_log("Error creating video thumbnail from $resource to $fullPath.");
				return false;
			}
		} else {
			if ($thumbOnly) return $thumbPath;
			if (!$image = imagecreatefromstring(file_get_contents($resource))) {
				write_log("Error creating image thumbnail from $resource.", "ERROR");
				return false;
			}

			$new_image = imagecreatetruecolor($newWidth, $newHeight);
			$min_size = min(imagesx($image), imagesy($image));
			imagecopyresampled($new_image, $image, 0, 0, round((imagesx($image) - $min_size) / 2), 0, $newWidth, $newHeight, $min_size, $min_size);
			write_log("Resampling image.");
			imagedestroy($image);
			if ($thumbPath !== $resource) {
				write_log("Here's where I write data to $thumbPath");
				if ($thumbPath !== "") {
					imagepng($new_image, $thumbPath);
				} else {
					write_log("Error, thumb path is BLANK?", "ERROR");
				}
			} else {
				write_log("ERROR, DEST PATH IS SAME AS SOURCE.", "ERROR");
			}
			write_log("Image should be created...");
			//imagedestroy($new_image);
		}
	}
	if (file_exists($thumbPath)) write_log("Returning $thumbPath"); else write_log("ERROR PLACING IMAGE TO $thumbPath", "ERROR");
	return (file_exists($thumbPath)) ? $thumbPath : false;
}


function imageVid($movie, $out, $w, $h) {
	$movie = realpath($movie);
	write_log("Trying to convert $movie to $out.");
	$time = "00:00:10";
	$cmd = FFMPEG_PATH . " -i '$movie' 2>&1";
	exec($cmd, $results);
	foreach($results as $line) {
	    if (preg_match("/Duration:/", $line)) {
	        $len = explode(",", str_replace("Duration: ", "", $line))[0];
		    $seconds = strtotime($len) - strtotime('00:00:00');
		    $int = $seconds / 2;
		    $t = round($int);
		    $time = sprintf('%02d:%02d:%02d', ($t/3600),($t/60%60), $t%60);
		    write_log("Clip is $seconds long, half is $int, time should be $time");
        }
    }
	$cmd2 = FFMPEG_PATH . " -ss $time -i \"$movie\" -frames:v 1 -q:v 2 -vf \"scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}\" \"$out\" 2>&1";
	write_log("Command is $cmd2");
	exec($cmd2, $results);
	foreach($results as $line) {
	    if (preg_match("/Output #/", $line)) {
	            write_log("looks like we were successful...");
	            return true;

        }
    }
	return true;
}


function listDirectory($dir, $thumbOnly = false, $background = false) {
	write_log("Incoming path is " . $dir, "INFO");
	$path = $dir;
	$rootPath = GALLERY_ROOT;
	$infoPath = DATA_ROOT . 'info' . DIRECTORY_SEPARATOR;
	$dataPath = str_replace($rootPath, $infoPath, $dir) . "_dirList";
	write_log("Trying to replace $rootPath with $infoPath in $dir for $dataPath", "INFO");
	$time = getTime($dir);
	write_log("Listing dir from $dataPath");
	$dirJson = (file_exists($dataPath)) ? json_decode(file_get_contents($dataPath), true) : false;
	$lastTime = $dirJson['time'] ?? false;
	if (!file_exists($dataPath)) write_log("NO FILE FOR DIR at '$dataPath' !!");
	write_log("LastTime: $lastTime");
	cleanFolders($dir);
	if ($time !== $lastTime) {
	    if ($background && !$thumbOnly) {
			file_put_contents("$dir/_building", "1");
			$result = ['building'];
			write_log("Returning: ".json_encode($result));
			curlQuick($_SERVER['PHP_SELF'] . "./index.php?cmd=json&id=$dir&background=false");
		    return $result;
	    }
	    $results = ['path' => $path, 'time' => $time, 'favorites' => []];
		write_log("Function fired for $path");
		if (!is_readable($path)) write_log("PATH IS NOT READABLE.", "ERROR");
		$paths = [];
		foreach (new DirectoryIterator($path) as $file) {
			if ($file->isDot()) continue;
			$name = $file->getFilename();
			$type = $file->isDir() ? 'dir' : fileId($name);
			if (!isset($results[$type])) $results[$type] = [];
			$path = localPath($file->getPathname());
			$paths[] = $path;
			$item = [
				'name' => $name,
				'path' => $path,
				'time' => $file->getMTime(),
				'size' => $file->getSize(),
				'type' => $type
			];
			if (filterFile($item)) $results[$type][] = $item;
			if ($thumbOnly) write_log("Returning for thumb: " . json_encode($results), "ALERT");
			if ($type !== 'file' && count($results[$type]) && $thumbOnly) {
				return $results;
			} else {
				if ($thumbOnly) write_log("Still searching for a thumb.");
			}
		}

		$write = file_put_contents($dataPath, json_encode($results)) ? "Success" : "write failed";
		write_log("Result of save: ". $write);
	} else {
		if (file_exists("$dir/_building")) {
            unlink("$dir/_building");
		}
		$results = $dirJson;
	}
	return $results;
}


function localPath($dir) {
	$real = realpath($dir);
	$str = str_replace(realpath(GALLERY_ROOT) . DIRECTORY_SEPARATOR, GALLERY_ROOT, $real);
	if (is_dir($dir)) $str .= DIRECTORY_SEPARATOR;
	return $str;
}


function makeLinks($path) {
	write_log("Making links for path: $path");
	$paths = [];
	$homePath = ['name' => 'Home', 'link' => urlString(GALLERY_ROOT)];
	$links = explode(DIRECTORY_SEPARATOR, $path);
	$current = "";
	if (is_array($links)) {
	    $i = 0;
	    foreach($links as $link) {
		    if (!$link || ($link == "." && $i)) continue;
		    $current .= $link . DIRECTORY_SEPARATOR;
		    $paths[] = ['name' => $link, 'link' => urlString($current)];
			$i ++;
		}
	}
	$paths[0] = $homePath;
	return $paths;
}


function mkDirs($dir) {
	return (is_dir($dir)) ? is_readable($dir) : mkdir($dir, 0777, true);
}


function putFile($path, $data) {
	if (is_array($data)) $data = json_encode($data);
	mkDirs(dirname($path));
	file_put_contents($path, $data);
}


function rmDirs($dir) {
	if (!file_exists($dir)) return true;
	if (str_replace(DATA_ROOT, GALLERY_ROOT, $dir) === $dir) {
	    write_log("Looking for ". DATA_ROOT . " in $dir");
		write_log("NO.");
		return false;
	}
	if (!is_dir($dir)) return unlink($dir);

	foreach (scandir($dir) as $item) {
		if ($item == '.' || $item == '..' || $item == "/") {
		    write_log("'$item' is either the current/parent directory, root folder, or not data root. Not doing it.", "ERROR");
			continue;
		}
		if (!rmDirs($dir.DIRECTORY_SEPARATOR.$item)) return false;
	}
	return rmdir($dir);
}


function randomKey($nr) {
	$a = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
	$res = '';
	for ($i = 0; $i < $nr; $i++) {
		$res .= $a[mt_rand(0, strlen($a) - 1)];
	}
	return $res;
}

function randomToken($length = 32) {
	if (!isset($length) || intval($length) <= 8) {
		$length = 32;
	}
	if (function_exists('openssl_random_pseudo_bytes')) {
		write_log("Generating using pseudo_random.");
		return bin2hex(openssl_random_pseudo_bytes($length));
	}
	$val = false;
	// Keep this last, as there appear to be issues with random_bytes and Docker.
	if (function_exists('random_bytes')) {
		write_log("Generating using random_bytes.");
		try {
			$val = bin2hex(random_bytes($length));
		} catch (Exception $e) {
		}
	}
	if (!$val) {
		$randomStr = '';
		$chars='0123456789abcdefghijklmnopqrstuvwxyz!@#$%%^&*()_+=-';
		$i = 0;
		$allowedMaxIdx = mb_strlen($chars) - 1;
		while ($i < $length) {
			try {
				$randomStr .= $chars[random_int(0, $allowedMaxIdx)];
			} catch (Exception $e) {
			}
			$i++;
        }
        $val = ($randomStr) ? $randomStr : false;
    }
	return $val;
}


function removeFromData($name) {
	$items = ['info', 'thumb'];
	foreach($items as $path) rmDirs(DATA_ROOT . $path . DIRECTORY_SEPARATOR . $name);
}


function setFavorite($dir, $item, $delete = false) {
    $result = false;
	$rootPath = GALLERY_ROOT;
	$infoPath = DATA_ROOT . 'info' . DIRECTORY_SEPARATOR;
	$fetch = false;
	if (function_exists('filterDir') && !$delete) $fetch = filterDir($item);
	if ($fetch) write_log("Fetching for $fetch");
	$dir = localPath($dir);
	$dataPath = str_replace($rootPath, $infoPath, $dir) . "_dirList";
	$data = json_decode(file_get_contents($dataPath), true);

	write_log("Need to replace $rootPath with $infoPath in $dir");
    write_log("We have the meats: ".json_encode($data));
	$favorites = $data['favorites'] ?? [];
    write_log("Current favorite list: ".json_encode($favorites));
    $i = 0;
    $key = false;
    foreach($favorites as $check => $favorite) {
        if ($favorite === $item) {
			$key = $check;
			write_log("WE HAVE A MATCH, setting key to $key", "INFO");
			break;
		}
        $i++;
    }
    if (!$key) {
        if (!$delete) {
			write_log("Setting favorite $item");
			array_push($favorites, $item);
			$result = true;
		}
    } else {
        if ($delete) {
			write_log("Removing favorite $item - $key");
			unset($favorites[$key]);
			write_log("New favorites array: " . json_encode($favorites));
			$result = true;
		}


    }
    if ($result) {
        $data['favorites'] = array_unique($favorites);
		write_log("Real path? " . realpath($dataPath));
		file_put_contents($dataPath, json_encode($data));
		return $data;

	}
	return $result;
}


function stringCrypto($string, $action = 'e') {
	$secret_key = SECURITY_PHRASE;
	$secret_iv = 'my_simple_secret_iv';
	$output = $string;
	$encrypt_method = "AES-256-CBC";
	$key = hash('sha256', $secret_key);
	$iv = substr(hash('sha256', $secret_iv), 0, 16);

	if ($action == 'e') {
		if (function_exists('openssl_encrypt') && ENCRYPT_LINKS) {
			$output = openssl_encrypt($output, $encrypt_method, $key, 0, $iv);
			$output = base64_encode($output);
		} else {
			$output = base64_encode($output);
		}
	} else if ($action == 'd') {
		if (function_exists('openssl_encrypt') && ENCRYPT_LINKS) {
			$output = base64_decode($output);
			$output = openssl_decrypt($output, $encrypt_method, $key, 0, $iv);
		} else {
			$output = base64_decode($output);
		}
	}

	return $output;
}


function stringUrl($string, $force=false) {
	$string = str_replace("/", DIRECTORY_SEPARATOR, $string);

	if (PROTECT_LINKS || $force) {
	    $string = stringCrypto($string, "d");
	    if ($string) {
		    write_log("Decrypted: $string");
		    $parts = explode("*", $string);
	    }
	    $string = $parts[0] ?? $string;
    }
    write_log("Result: " . $string);
    return $string;
}


function urlString($path, $force=false) {
	if (PROTECT_LINKS || $force) {
		$time = getTime($path);
		$path = stringCrypto("$path*$time");;
	}
	$path = str_replace(DIRECTORY_SEPARATOR, "/", $path);
	$path = str_replace("\\", "/", $path);
	return $path;
}


function write_log($text, $level = false) {
    $ds = DIRECTORY_SEPARATOR;
	mkDirs(LOG_PATH);
	$log = LOG_PATH . "${ds}img.log.php";
	if (!file_exists($log)) {
		touch($log);
		chmod($log, 0666);
		$authString = "; <?php die('Access denied'); ?>" . PHP_EOL;
		file_put_contents($log, $authString);
	}
	if (filesize($log) > 4194304) {
		$oldLog = LOG_PATH . "${ds}img.log.old.php";
		if (file_exists($oldLog)) unlink($oldLog);
		rename($log, $oldLog);
		touch($log);
		chmod($log, 0666);
		$authString = "; <?php die('Access denied'); ?>" . PHP_EOL;
		file_put_contents($log, $authString);
	}

	$aux = microtime(true);
	$now = DateTime::createFromFormat('U.u', $aux);
	if (is_bool($now)) {
		$aux += 0.001;
		$now = DateTime::createFromFormat('U.u', $aux);
	}
	$date = $now->format("m-d-Y H:i:s.u");
	$level = $level ? $level : "DEBUG";
	$caller = getCaller() ?? "foo";

	$line = "[$date] [$level] [$caller] - $text" . PHP_EOL;

	if (!is_writable($log)) return;
	if (!$handle = fopen($log, 'a+')) return;
	if (fwrite($handle, $line) === false) return;

	fclose($handle);
}


function xit($msg=false) {
	if ($msg) write_log($msg);
	write_log("----------------- END REQUEST -----------------");
	die();
}


?>
<!DOCTYPE html>
	<html>
		<head>
			<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0">
            <meta name="pageKey" id="pageKey" content="<?php echo DIR_KEY ?>">
            <meta name="protectKey" id="protectKey" content="<?php echo PROTECT_LINKS ?>">
			<title><?php echo GALLERY_NAME ?></title>
			<link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.5.0/css/all.css" integrity="sha384-B4dIYHKNBt8Bc12p+WXckhzcICo0wtJAoU8YZTY5qE0Id1GSseTk6S+L3BlXeVIU" crossorigin="anonymous">
			<link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css" integrity=\"sha384-Gn5384xqQ1aoWXA+058RXPxPg6fy4IWvTNh0E263XmFcJlSAwiGgFAW/dAiS6JXm" crossorigin="anonymous">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/3.7.0/animate.min.css">
			<link rel='stylesheet' href='./_resources/css/main.css'>
        </head>
        <body>
        <nav class="navbar fixed-top navbar-dark navbar-expand-md bg-dark row justify-content-between">
            <div id="navi" class="col-10 col-md-7 col-lg-11 mr-auto">
                <ol class="breadcrumb">
					<?php echo DIR_HEADER ?>
                </ol>
            </div>
            <button class="navbar-toggler mr-4" type="button" data-toggle="collapse" data-target="#navbarSupportedContent" aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="Toggle navigation">
                <span class="navbar-toggler-icon"></span>
            </button>

            <div class="collapse navbar-collapse navInputs navShow row justify-content-center" id="navbarSupportedContent">

                <div class="form-inline my-2 my-lg-0">
                    <div class="inputWrap row justify-content-center">
                        <input type="text" id="divFilter" class="form-control" placeholder="Filter" aria-label="Filter" aria-describedby="btnGroupAddon">
                        <div class="btn-group" role="group" aria-label="">
                            <div class="btn btn-secondary iconBtn" id="sortType" onclick="sortGallery('type')">
                                <span class="fa fa-sort-alpha-down selIcon"></span>
                            </div>
                            <div class="btn btn-secondary iconBtn" id="sortDirection" onclick="sortGallery('direction')">
                                <span class="fa fa-sort-down dirIcon"></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="sortWrap">
                <div class="btn-grp" role="group">

                </div>
            </div>
        </nav>
        <div id="galleryDiv" class="gridContainer">
            <div id="galleryContent" class="grid"></div>
            <div id='loader' class="lds-ripple"><div></div><div></div></div>
        </div>
        <div id="scrollTip"></div>
        <div id="galleryModal" class="galleryModal">
            <div id="fullWrap">
                <div class="full_image fit active imgItem animated faster"></div>

                <video id="video1" class="vidItem animated faster">
                    <source type="video/mp3" src="">
                    <source type="video/ogg" src="">
                    <source type="video/mp4" src="">
                    <source type="video/mov" src="">
                    <source type="video/mkv" src="">
                    <source type="video/mv4" src="">
                    <source type="video/webm" src="">
                    Your browser does not support HTML5 video.
                </video>

            </div>
            <div id="mediaTitle" class="navBtn mediaText"></div>
            <div id="mediaInfo" class="navBtn mediaText"></div>
            <div id="cycleLeft" class="navBtn fadeOut left cycleBtn">
                <div class="cycleIndicator left">
                    <span class="fa fa-chevron-left"></span>
                </div>
            </div>
            <div id="cycleRight" class="navBtn fadeOut right cycleBtn">
                <div class="cycleIndicator right">
                    <span class="fa fa-chevron-right"></span>
                </div>
            </div>
            <div id="closeBtn" class="navBtn fadeOut" onclick="closeMedia()">
                <span class="fa fa-window-close"></span>
            </div>
            <div id="fullToggle" class="navBtn fadeOut">
                <span class="fa fa-expand toggleIcon"></span>
            </div>
        </div>
        <div id="waitModal" class="waitModal">
            <table class="dhmg_disp">
                <tr>
                    <td class="mid">
                        <div id="wait"></div>
                    </td>
                </tr>
            </table>
        </div>
        <div id="infoModal" class="infoModal">
            <div id="box_inner_info"></div>
        </div>

        <script src="https://code.jquery.com/jquery-3.3.1.min.js" integrity="sha256-FgpCb/KJQlLNfOu91ta32o/NMZxltwRo8QtmkMRdAu8=" crossorigin="anonymous"></script>
        <script src="https://code.jquery.com/ui/1.12.0/jquery-ui.min.js" integrity="sha256-eGE6blurk5sHj+rmkfsGYeKyZx3M4bG+ZlFyA7Kns7E=" crossorigin="anonymous"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/hammer.js/2.0.8/hammer.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/js-cookie@2/src/js.cookie.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.12.9/umd/popper.min.js" integrity="sha384-ApNbgh9B+Y1QKtv3Rn7W3mgPxhU9K/ScQsAP7hUibX39j7fakFPskvXusvfa0b4Q" crossorigin="anonymous"></script>
        <script src="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/js/bootstrap.min.js" integrity="sha384-JZR6Spejh4U02d8jOt6vLEHfe/JQGiRRSQQxSfFWpi1MquVdAyjUar5+76PVCmYl" crossorigin="anonymous"></script>
        <script src="https://cdn.jsdelivr.net/npm/lozad/dist/lozad.min.js"></script>
        <script src="./_resources/js/touch-emulator.js"></script>
        <script src='https://unpkg.com/panzoom@7.1.0/dist/panzoom.min.js'></script>
        <script src="./_resources/js/main.js"></script>

    </body>
</html>