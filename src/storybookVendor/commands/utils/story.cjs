// Returns true or false if the story should be skipped based on include and exclude config
function skipStory(story, config) {
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

module.exports = { skipStory };