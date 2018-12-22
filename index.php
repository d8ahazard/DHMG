<?php
/*

Digitalhigh's Multimedia Gallery 1.0.0

Released: January 1, 2019
by Digitalhigh

*/

if (file_exists("./_sort/sort.php")) require_once("./_sort/sort.php");

define('GALLERY_NAME', 'Pocket Gallery');
//define('FFMPEG_PATH', 'D:\xampp\ffmpeg.exe');
define('FFMPEG_PATH', 'ffmpeg');



define('EXCLUDE_ARRAY', [ // Add files here to ignore in listing
		"_data",
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
	]);

define('SHOW_IMAAGES', true);
define('SHOW_VIDEOS', true);
define('SHOW_FILES', true);

// UI maxes out at 250, so there's no reason to make this larger.
// Decrease to save a little space/speed
define('THUMB_SIZE', 250);

//	----------- CONFIGURATION END ------------
$root = fixPath(dirname(__FILE__));
define('ROOT', $root);
define('DATA_DIR', "$root/_data");
define('THUMB_DIR', "$root/_data/thumb");
define('INFO_DIR', "$root/_data/info");
define('LOG_DIR', "$root/_data/logs");
define('FAV_DIR', "$root/_data/favorite");

foreach([THUMB_DIR, INFO_DIR, LOG_DIR, FAV_DIR] as $dir) mkDirs($dir);

error_reporting(E_ALL);
ini_set('max_execution_time', 0);
ini_set('memory_limit', -1);
set_time_limit(0);
ini_set("log_errors", 1);
ini_set("error_log", LOG_DIR . "/Error.log.php");



_initialize();
/**
 * Reads GET params and returns/sets data accordingly.
 */

function _initialize() {
	$path = localPath(ROOT);
	$infoPath = INFO_DIR . "/.info";
	$thumbPath = false;
	if (isset($_GET['id'])) {
		write_log("We got an ID: ". $_GET['id']);
		$path = pathify($_GET['id'], true);
		$infoPath = INFO_DIR . $path . "/.info";
		$thumbPath = THUMB_DIR . $path . ".png";
		//if ($path !== ".") $path = "." . $path;
	}

	define('HOME', $path);
	define('THUMB', $thumbPath);
	define('INFO', $infoPath);
	write_log("HTI: " . HOME . " , " . THUMB . " , " . INFO);

	if (isset($_GET['build'])) {
	    write_log("BUILDING THUMBS.");
	    buildThumbs();
	    xit();
    }

    if (isset($_GET['favorite'])) {
        $remove = isset($_GET['delete']);
		write_log("Setting favorite, remove is $remove");
		setFavorite($path, $remove);
        xit();
    }

	if (isset($_GET['time'])) {
		header('Content-Type: text/plain');
		echo getTime($path);
		xit();
	}

	if (isset($_GET['json'])) {
	    write_log("JSON REQUEST...");
		header("Content-Type: application/json");
		echo dirJson($path);
		xit();
	}

	if (isset($_GET['thumb'])) {
	    write_log("BUILD A DAMNED THUMB");
	    //echo "$path";
		$queuePath = THUMB_DIR . "/queue";
		if (is_dir($path)) $path = listDir($path, true);
		$thumb = getThumb($path);
		write_log("Returning thumb from $thumb");
	    if (file_exists($thumb)) {
			$queueId = pathify($thumb);
			$queueFile = $queuePath . "/$queueId.q";
            if (file_exists($queueFile)) unlink($queueFile);
			$name = basename($thumb);
			header('Content-Type: image/png');
			header("Content-Disposition: filename='$name'");
			readfile($thumb);
		}
	    xit();
    }

	if (isset($_GET['file'])) {
		header('Location: ' . $path);
		xit();
	}

	define("DIR_KEY", pathify(localPath($path)));
	define("DIR_PATH", localPath($path));
	$paths = makeLinks(localPath($path));
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


function buildThumbs() {
    $queuePath = THUMB_DIR . "/queue";
	$files = glob($queuePath . "/*.q");
	foreach($files as $thumb) {
	    $og = $thumb;
	    $thumb = str_replace(".q", "", $thumb);
	    $thumb = str_replace($queuePath . "/", "", $thumb);
	    $thumb = str_replace("//", "", $thumb);
	    $thumbSrc = pathify($thumb, true);
	    if (trim($thumbSrc)) {
			write_log("I should build a thumb for $thumbSrc now.");
			getThumb($thumbSrc);
        }
        unlink($og);
	}
}


/**
 *
 * Sends a CURL command without waiting for a reply
 *
 * @param $url
 */
function curlQuick($url) {
	write_log("Quick curl fired for $url");
	$ch = curl_init($url);
	if (function_exists('auth_headers')) {
	    $hs = auth_headers();
	    write_log("Setting auth headers: to $hs");
		curl_setopt($ch, CURLOPT_USERPWD, $hs);
		curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);
	}

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
	write_log("Curlquick done...");
}


function dirJson($path) {
    write_log("Local path is $path");
	$fav = listFav($path);
	$data = [];
	$data['favorites'] = $fav;

	if (file_exists(INFO)) {
	    write_log("Info exists.");
	    if (getTime($path) === getTime(INFO)) {
            write_log("File times match!.");
            $data['items'] = json_decode(file_get_contents(INFO), true);
            return json_encode($data);
        } else {
	        write_log("File times don't match: ". getTime($path) . ' and ' . getTime(INFO));
	        $data['items'] = updateDir($path);
	        putInfo($path, $data['items']);
	        return json_encode($data);
        }
    }

    $data['items'] = listDir($path);
	putInfo($path, $data['items']);
	return json_encode($data);
}


/**
 *
 * Reads and returns a type for a path.
 * If returnType is set, it returns the filetype, otherwise, a classifaction.
 *
 * @param $file
 * @param bool $returnType
 * @return string
 */
function fileId($file, $returnType = false) {
	$parts = explode(".", $file);
	$type = strtolower(array_pop($parts));
	$image_types = ['jpg', 'jpeg', 'png', 'gif'];
	$video_types = ['mp4', 'mov', 'mkv', 'm4v', 'webm'];
	$audio_types = ['mp3', 'wav', 'ogg'];
	if (is_dir($file)) return 'dir';
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


/**
 *
 * Determine if a file should be displayed in the gallery
 *
 * @param $file
 * @return bool
 */
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
		case 'img':
			return SHOW_IMAAGES;
		default:
			return true;
	}
}


/**
 *
 * Makes a windows path normal
 *
 * @param $path
 * @return mixed
 */
function fixPath($path) {
	return str_replace("\\", "/", $path);
}


/**
 *
 * Returns the class calling "write_log";
 *
 * @return string
 */
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


function getThumb($resource) {
	$or = $resource;
	$image_type = fileId($resource);
	if ($image_type !== 'vid' && $image_type !== 'img') return false;
	$resource = trim($resource);
	$resource = str_replace("./", "", $resource);

	$thumbPath = THUMB_DIR . "/$resource.png";
	$thumbPath = str_replace("//", "/", $thumbPath);
	$resource = str_replace("//", "/", $resource);
	if (file_exists($thumbPath)) {
		return $thumbPath;
	} else {
		write_log("Constructing thumb for '$resource', couldn't find it at '$thumbPath'");
		$newWidth = THUMB_SIZE;
		$newHeight = THUMB_SIZE;
		mkDirs(dirname($thumbPath));

		if ($image_type === 'vid') {
			write_log("Got us a thumb request for a video!", "ALERT");
			$fullPath = str_replace(realpath(ROOT), realpath(THUMB_DIR), $thumbPath);
			if ($fullPath === $resource) return false;
			if (!imageVid($resource, $fullPath, $newWidth, $newHeight)) {
				write_log("Error creating video thumbnail from $resource to $fullPath.");
				return false;
			}
			return $fullPath;
		} else {
			if (!$image = imagecreatefromstring(file_get_contents($resource))) {
				write_log("Error creating image thumbnail from $resource, original path is $or.", "ERROR");
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


/**
 *
 * Returns the current time for a file/directory
 *
 * @param $item
 * @return bool|int
 */
function getTime($item) {
    $item = fixPath(realpath($item));
	if (is_dir($item)) $item .= "/.";
	$time = filemtime($item);
	write_log("Time for $item is $time");
    return $time;
}


/**
 *
 * Save a thumbnail from a video
 *
 * @param string $movie
 * @param string $out
 * @param int $w
 * @param int $h
 * @return bool
 */
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


/**
 *
 * List the contents of a directory.
 * If "thumbOnly" is specified, it should try to find, in order, the first image, then video, then directory
 * and return ONLY that item
 *
 * @param $path
 * @param $thumbOnly
 * @return array|bool|mixed
 */
function listDir($path, $thumbOnly = false) {
    if (!$thumbOnly) write_log("Trying to list $path");
	$results = [];
	$thumbs = [];
	foreach (new DirectoryIterator($path) as $file) {
		if ($file->isDot()) continue;
		$name = $file->getFilename();
		$type = $file->isDir() ? 'dir' : fileId($name);
		$item = [
			'name' => $name,
			'time' => $file->getMTime(),
			'size' => $file->getSize(),
			'type' => $type,
            'link' => pathify($path . "/" . $name)
		];
		$thumb = $thumbPath = false;
		if (filterFile($item)) {
			if ($type === 'img' || $type === 'vid') $thumb = $path . "/" . $name;
			if ($item['type'] === 'dir') $thumb = listDir($path . "/" . $name, true);
			if ($thumb) {
			    $fixed = str_replace("./", "/", $thumb);
			    $thumbPath = THUMB_DIR . "/$fixed.png";
			    $thumbPath = str_replace("//", "/", $thumbPath);
				if (!file_exists($thumbPath)) $thumbs[] = $thumb;
				$item['thumb'] = localPath($thumbPath);
				if ($thumbOnly) return $thumb;
            }
			$results[] = $item;
		}
	}
    if ($thumbOnly) return false;
    if (count($thumbs)) queueThumbs($thumbs);
    return $results;
}


function listFav($path) {
    if ($path === ".") $path = "";
    $favPath = FAV_DIR . str_replace("./", "/", $path);
	write_log("Path is $path, favPath is $favPath");
	$favorites = glob($favPath . "/*.fav");
	foreach($favorites as &$favorite) {
	    write_log("Replacing '". FAV_DIR . "/" . "' with './' in $favorite");
		$favorite = str_replace(FAV_DIR . "/", "./", $favorite);
		write_log("Fav item: $favorite");
		$favorite = pathify(str_replace(".fav", "", $favorite));
	}
	write_log("FAVORITES: ".json_encode($favorites));
	return $favorites;
}


function localPath($path) {
    $out = str_replace(ROOT, ".", $path);
    if ($out === "") $out = ".";
    return $out;
}


/**
 * @param $path
 * @return array
 */
function makeLinks($path) {
	write_log("Making links for path: $path");
	$paths = [];
	$homePath = ['name' => 'Home', 'link' => pathify("./")];
	$links = explode("/", $path);
	$added = [];
	if (is_array($links)) {
		$i = 0;
		foreach($links as $link) {
			if (!$link || ($link == "." && $i)) continue;
			$added[] = $link;
			//$current .= $link . "/";
			$paths[] = ['name' => $link, 'link' => pathify(implode("/", $added))];
			$i++;
		}
	}
	$paths[0] = $homePath;
	return $paths;
}


/**
 *
 * Recursively create a directory if it doesn't exist
 *
 * @param $dir
 * @return bool
 */
function mkDirs($dir) {
	return (is_dir($dir)) ? is_readable($dir) : mkdir($dir, 0777, true);
}


/**
 *
 * Convert a path to a base64-encoded value, or decode if $decode is true
 *
 * @param $path
 * @param bool $decode
 * @return string
 */
function pathify($path, $decode=false) {
	if ($decode) {
	    $padded = str_pad(strtr($path, '-_', '+/'), strlen($path) % 4, '=', STR_PAD_RIGHT);
	    $out = base64_decode($padded);
		write_log("padded to $padded, returning $out");
        return $out;
	} else {
		$path = str_replace(ROOT, "", fixPath($path));
		return rtrim(strtr(base64_encode($path), '+/', '-_'), '=');
	}
}


/**
 *
 * Write data to a specified path. Creates directories as needed, encodes arrays to JSON automagically.
 *
 * @param $path
 * @param $data
 */
function putInfo($path, $data) {
    if (is_array($data)) $data = json_encode($data);
	mkDirs(dirname(INFO));
	$time = getTime($path);
	write_log("Trying to put info to " . INFO);
	file_put_contents(INFO, $data);
	touch(INFO, $time);
}


/**
 *
 * Recursively remove directories
 *
 * @param $dir
 * @return bool
 */
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


/**
 *
 * Generate a random token
 *
 * @param int $length
 * @return bool|string
 */
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


function queueThumbs($thumbs) {
    $queuePath = THUMB_DIR . "/queue";
    mkDirs($queuePath);
    foreach($thumbs as $thumb) {
        $queueId = pathify($thumb);
        $queueFile = $queuePath . "/$queueId.q";
        write_log("Queueing File: $queueFile");
        if (!file_exists($queueFile)) {
            touch($queueFile);
        } else {
            write_log("File $thumb is already queued for creation.");
        }
    }
	$url = "http://gandalf/index.php?build";
	curlQuick($url);
}


function setFavorite($item, $delete = false) {
	$result = false;
	$fetch = false;
	if (function_exists('filterDir') && !$delete) $fetch = filterDir($item);
	if ($fetch) write_log("Fetching for $fetch");
	$favPath = FAV_DIR . str_replace("./", "/", $item) . ".fav";
	write_log("Setting favorite for '$item', checking in $favPath");
	if ($delete) {
	    if (file_exists($favPath)) {
			write_log("Deleting...");
			unlink($favPath);
        }

    } else {
	    write_log("Adding");
	    mkdirs(dirname($favPath));
	    touch($favPath);
    }
	return $result;
}


function updateDir($path) {
    $existing = json_decode(file_get_contents(INFO), true);
    $current = listDir($path);
    $del = array_diff_assoc($existing, $current);
	$add = array_diff_assoc($current, $existing);
	write_log("Files to delete: " . json_encode($del));
	write_log("Files to add: " . json_encode($add));
	return $current;
}


function write_log($text, $level = false) {
	$log = LOG_DIR . "/img.log.php";
	if (!file_exists($log)) {
		touch($log);
		chmod($log, 0666);
		$authString = "; <?php die('Access denied'); ?>" . PHP_EOL;
		file_put_contents($log, $authString);
	}
	if (filesize($log) > 4194304) {
		$oldLog = LOG_DIR . "/img.log.old.php";
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


/**
 *
 * End script execution with a log message. Add an optional ending message...
 *
 * @param string | bool $msg
 */
function xit($msg=false) {
	if ($msg) write_log($msg);
	write_log("----------------- END REQUEST -----------------");
	die();
}


?>
<!DOCTYPE html>
<html>
<head>
	<link rel="shortcut icon" href="./_resources/img/favicon.ico">
	<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0">
	<meta name="pageKey" id="pageKey" content="<?php echo DIR_KEY ?>">
    <meta name="pagePath" id="pagePath" content="<?php echo DIR_PATH ?>">
	<title><?php echo GALLERY_NAME ?></title>
	<link rel="stylesheet" href="./_resources/css/lib/all.min.css">
	<link rel="stylesheet" href="./_resources/css/lib/bootstrap.min.css">
	<link rel="stylesheet" href="./_resources/css/lightgallery.min.css">
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
	<div id="galleryContent" class="sortGrid fadeOut"></div>
	<div id='loader' class="lds-ripple"><div></div><div></div></div>
</div>
<div id="scrollTip"></div>
<div id="lightContent" class="hide">

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

<script src="./_resources/js/lib/jquery-3.3.1.min.js"></script>
<script src="./_resources/js/lib/js.cookie.min.js"></script>
<script src="./_resources/js/lib/shuffle.min.js"></script>
<script src="./_resources/js/lib/lightgallery.min.js"></script>
<script src="./_resources/js/lib/lightgallery-all.min.js"></script>
<script src="./_resources/js/lib/popper.min.js"></script>
<script src="./_resources/js/lib/bootstrap.min.js"></script>
<script src="./_resources/js/lib/blazy.min.js"></script>
<script src="./_resources/js/main.js"></script>

</body>
</html>