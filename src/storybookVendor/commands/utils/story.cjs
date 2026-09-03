// A story index is only usable if it is a plain object whose values are objects. Returns the
// entries, or null when the payload is not a story index at all.
//
// Guarding this is not theoretical. A truncated or hand-edited index.json can carry
// `entries: null`, no `entries` key, or a bare string, and each used to fail differently and
// badly: the first two crashed with a raw TypeError ("Cannot convert undefined or null to
// object"), and a string was iterated by character index, producing stories called "0", "1",
// "2", "3" that were then uploaded to the backend as if they were real.
function normalizeStoryEntries(raw) {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
	const entries = {};
	for (const [id, story] of Object.entries(raw)) {
		// Junk entries are dropped rather than crashing the run. If that empties the index the
		// caller's "No stories found" path reports it cleanly.
		if (story && typeof story === 'object' && !Array.isArray(story)) entries[id] = story;
	}
	return entries;
}

// Returns true or false if the story should be skipped based on include and exclude config
function skipStory(story, config) {
	// Defensive: callers normalise first, but skipStory is also called directly.
	if (!story || typeof story !== 'object') return true;

	// skip story if it's docs for version 7
	if (story.parameters && story.parameters.docsOnly) {
		return true;
	}

	// skip story if it's docs for version 8
	if(story.type && story.type === 'docs'){
		return true;
	}

    let matches = regexp => {
		if (typeof regexp === 'string') {
			let [, parsed, flags] = /^\/(.+)\/(\w+)?$/.exec(regexp) || [];
			regexp = new RegExp(parsed ?? regexp, flags);
		}
  
      	return regexp?.test?.(story.name);
    };
  
    let include = [].concat(config?.include).filter(Boolean);
    let exclude = [].concat(config?.exclude).filter(Boolean);

    let skip = include?.length ? !include.some(matches) : false;
    if (!skip && !exclude?.some(matches)) return false;
    return true;
};

module.exports = { skipStory, normalizeStoryEntries };