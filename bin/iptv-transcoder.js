/*

MPEGTS Transcoder

event emitter

@ events
	
	error : error in transcoding process
	
	finish : transcoding process terminated

	close : ffmpeg process closed

@ end events

*/

var Trans 		 = require('stream-transcoder');
var util       	 = require("util");
var EventEmitter = require("events").EventEmitter;
var debug		 = require('debug')('iptvplayer:transcoder');
var kill 		 = require('tree-kill');
var xtend 		 = require('xtend');


var IPTVTranscoder = function() {
		
	EventEmitter.call(this);
	
	this.url = null;
	
	this.ffmpeg_process = null;
}

util.inherits(IPTVTranscoder, EventEmitter);

//ware function

IPTVTranscoder.prototype.wf = function(){
	
	var self = this;
	
	return function(err,req,next){
		
		if(err) next(err);
		
		if(!req) next(new Error('request undefined'));
		
		switch(req.cmd){
			case 'play':
				xtend(req,{transcoder: self});
				break;
			case 'stop':
				self.close();
				break;
			case 'status':
				break;
			case default:
				return next(new Error('not valid command'));
		}
		
		next();
	}
}


IPTVTranscoder.prototype.launch = function(url) {
	
	// these args will be added by Trans._exec function :  '-i' , url
	var ffmpeg_arguments = [ '-vcodec' , 'copy' , '-f','mp4','-movflags' , 'frag_keyframe+faststart' , 'pipe:1' ];
	var t = new Trans(url);
	var child = t._exec(ffmpeg_arguments);
	
	var self = this;
	
	t.on('error', function(err) {
			
		debug("ffmpeg process : error = " + err);
		// Error in transcoding process
		self.emit('error', new Error('FFmpeg standard input error'));
	});
	
	t.on('finish', function(code) {
		
		debug("ffmpeg process : finish event " + code);
		
		if (!code) 
			self.emit('finish');
		else {
			if(code !== 255)
			self.emit('error', new Error('FFmpeg error ' + code));
		}
	});
	
	child.on('close',function(code,signal){
		
		self.emit('close');
		debug("close event");	
	});
	
	debug('launching ffmpeg process pid:' + child.pid);
	
	this.url = url;
	this.ffmpeg_process = child;
}

IPTVTranscoder.prototype.stream = function(url) {
	
	this.launch(url);
	
	return (this.stream = this.ffmpeg_process.stdout);	
}

IPTVTranscoder.prototype.close = function() {
	
	debug("transcoder close function");
	
	var self = this;
	
	try{
		
	kill(this.ffmpeg_process.pid , 'SIGKILL' , function(err) {
		
		var pid = self.ffmpeg_process.pid;
		
	    if(err)
			debug('unable to kill ffmpeg process pid:' + pid);
		else
			debug('ffmpeg process killed pid:' + pid);
	});
	}
	catch(e){

		debug("ffmpeg process is not running");
	}
}

module.exports = IPTVTranscoder;
