// Service worker and caching code for FeedRead

////////////////////////////////////////
// Configurable variables:

// The top level of the feed dir:
var feedTop = '/feeds';

////////////////////// End configuration

const CACHENAME = "feed-read-cache";


// Current date in format mm-dd-day
var days = ["Sun", "Mon", "Tues", "Wed", "Thu", "Fri", "Sat"];
function formatDate(d) {
    var d = new Date();
    var date = d.getDate();
    if (date < 10) date = '0' + date;
    var month = d.getMonth() + 1;
    if (month < 10) month = '0' + month;
    var day = days[d.getDay()];
    return month + '-' + date + '-' + day;
}


// Fetch all the feeds generated today.
// Start with $feedTop/mm-dd-day/MANIFEST
// and then fetch all the files referenced there.

// XXX Zoe suggests async await as a more straightforward and
// easier to read alternative to promises.

// Variables used by fetchDaily:
var todayStr = null;
var manifestURL = null;
var manifestList = null;


// Read the manifest (which should already be in the cache)
// and set the global variable manifestList to its split contents.
// Returns a promise so you can call .then.
async function readManifest() {
    // For debugging: show if it's in the caches now.
    matchStatus = await caches.match(manifestURL);
    console.log("Here's " + manifestURL + " in the caches: " + matchStatus);

    console.log("fetching " + manifestURL);

    // Try to fetch from network, not cache:
    var myHeaders = new Headers();
    myHeaders.append('pragma', 'no-cache');
    myHeaders.append('cache-control', 'no-cache');
    var myRequest = new Request(manifestURL);
    var myInit = {
        method: 'GET',
        headers: myHeaders,
    };
    response = await fetch(myRequest, myInit);

    // response = await fetch(manifestURL);
    if (!response.ok) {
        err = new Error("Couldn't fetch " + manifestURL + ": status "
                        + response.status + " " + response.statusText);
        err.code = response.status;
        throw(err);
    }
    var txt = await response.text();
    console.log("Read text: '" + txt + "'");
    manifestList = txt.split(/\r?\n/);

    // This split adds a bogus final empty entry. Remove it.
    // Note, this won't do anything about empty lines in the
    // middle of the list, but feedme shouldn't create any.
    if (manifestList[manifestList.length-1] == "")
        manifestList.pop();
    console.log("Split into " + manifestList.length + " lines");
    return manifestList;
}

async function fetchDaily() {
    if (!todayStr)
        todayStr = formatDate(new Date());

    var todayURL = feedTop + '/' + todayStr + '/';
    manifestURL = todayURL + 'MANIFEST';

    try {
        const cache = await caches.open(CACHENAME);

        // Clear out the MANIFEST from the cache.
        // This is arguable, since really the MANIFEST shouldn't change,
        // but it's vaguely possible to have gotten an early copy of it
        // before it was fully written.
        // In any case, it's useful for testing.
        deleteStatus = await cache.delete(manifestURL);
        console.log("status of deleting " + manifestURL + ": " + deleteStatus);

        console.log("After deleting MANIFEST, the caches look like:");
        await showCached();

        // Read the manifest and parse it into an array, manifestList.
        const status = await readManifest();
        console.log("Read the manifest");
        if (!manifestList) {
            console.log("I guess reading the manifest failed");
            return status;
        }

        console.log("Inside the promise, the manifest has "
                    + manifestList.length + " lines");
        await cache.add(manifestURL);

        newURLs = [];
        for (f in manifestList) {
            if (! manifestList[f])
                continue;
            // Is it already cached?
            newurl = todayURL + manifestList[f];
            console.log("*   " + newurl);
            matchResponse = await cache.match(newurl);
            if (!matchResponse)
                console.log("    not in the cache");
            else
                console.log("    already cached");
        }
        return 0;
    }
    catch (err) {
        alert("fetch failed:" + err);
        return err;
    }
}

// Return a sorted list of all the top-level pages available.
// Don't try to format them into HTML.
async function TOC() {
    if (! CACHENAME) {
        console.log("CACHENAME is null, can't show TOC!");
        return null;
    }

    var cache = await caches.open(CACHENAME);
    var cachedFiles = await cache.keys();
    tocPages = [];
    for (var key in cachedFiles) {
        // Skip directories and the manifest:
        var url = cachedFiles[key].url;
        console.log("x ", url);
        if (url.endsWith('/') || url == "MANIFEST")
            continue

        // Find index.html files
        if (url.endsWith('index.html')) {
            tocPages.push(url);
        }
    }
    return tocPages;
}


function clearCaches() {
    caches.keys().then(function(keyList) {
        console.log(keyList.length + " files are cached:");
        for (f in keyList) {
            console.log("    deleting all of cache " + keyList[f]);
            caches.delete(keyList[f]);
        }
    });
}

function showCached() {
    caches.open(CACHENAME).then(function(cache) {
        cache.keys().then(function(keyList) {
            for (key in keyList) {
                // keyList[key] is a Request. Show its URL.
                console.log("cached: " + keyList[key].url);
            }
        });
    });
}


// Request persistent storage.
// navigator.storage.persist() actually requests permanent storage permission.
// You'll also see navigator.storage.persisted() but that just reports
// whether we already have permission, without actually requesting it.
if (navigator.storage && navigator.storage.persist)
    navigator.storage.persist().then(granted => {
        if (granted)
            console.log("Persistent storage granted");
        else
            console.log("No persistent storage permission");
    });

/*
// Service worker for cache, falling back to network.
console.log("Adding service worker:");
self.addEventListener('fetch', function(event) {
    console.log("fetch listener, " + event.request);
    event.respondWith(
        caches.match(event.request).then(function(response) {
            return response || fetch(event.request);
        })
    );
});
*/