
var ChromecastServer = require('../bin/chromecast-server');
var IptvTranscoder = require('../bin/iptv-transcoder');
var Player = require('chromecast-player');
var internalIp = require('internal-ip');
var xtend = require('xtend');
var debug = require('debug')('iptvplayer:player');
var util       	 = require("util");
var EventEmitter = require("events").EventEmitter;
var ware = require('ware');


var default_port = 8081;

var StatusEnum = {
  PLAY: 1,
  STOP: 2,
  IDLE: 3,
};

var IPTVPlayer = function(chromecast_port){
	
	if (!(this instanceof IPTVPlayer)) return new IPTVPlayer();
	
	this.chromecastport = chromecast_port || default_port;
	
	EventEmitter.call(this);
	
	this.iptvtranscoder = new IptvTranscoder();
	this.chromecastserver = new ChromecastServer();
	
	//set middleware
	this.mw = ware();
	
	
	var self = this;
	
	iptvtranscoder.on('finish', function(){
		//retry
		debug("emit finish event , retry?");
		self.emit('finish');
		//that.play(that.current_channel_index);
	});
	iptvtranscoder.on('error',function(error){
		debug("handler transcoder error event : " + error);
		debug("emit transcoding error event");
		self.emit('transcoding error');
	});
	
	//player info
	this.status = StatusEnum.IDLE;
	this.volume = null;
	this.currentchannel ={
		title: "",
		url: ""
	};
}

util.inherits(IPTVPlayer, EventEmitter);


IPTVPlayer.prototype.play = function(channel){
	
	this.currentchannel.url = channel;
	
	var self = this;
	
	var wf = function(err,req,next){
		
		var opts = {
	  		playlist: [ { path: '' } ] 
		}
	
		var player = new Player();
	
		player.use(function(ctx,next) {
			debug("player use- function");
	    	var ip = internalIp();
	    	ctx.options.playlist[0] = {
	      	path: 'http://' + ip + ':' + req.chromecastserverport,
	      	type: 'video/mp4',
		  	media: {
		          	metadata: {
		            	title: req.channel.title
		          		}
		        	}
	    	};
	    	ctx.options.disableTimeline = true;
	    	ctx.options.disableSeek = true;
	    	ctx.options = xtend(ctx.options, ctx.options.playlist[0]);
	    	ctx.options.playlist.shift();
			next();
		
		});
	
		player.launch(opts,function(err, p, ctx){
		
			if (err) {
      	  	  debug('player error: %o', err);
    		}
		
    		p.getVolume(function(err, status) {
				if (err){
					debug('unable to get volume status');
					return;
				}
      	  		self.volume = status;
    		});
		});
	};
	//end wf function
	
	var pack = {
		channel : {
			title: channel.title,
			url: channel.url
		},
		cmd: 'play'
	};
	var mw = this._buildmw(wf);
	mw.run(null,pack,function(err,req){
		if(err) return debug('error middleware run %o',err);
		debug('playing');
	});
}

IPTVPlayer.prototype._buildmw(wfs){
	var wfsa = [];
	if(!Array.isArray(wfs)) wmfa.push(wfs);
	else wfsa = wfs;
	
	var mw = ware()
		.use(this.iptvtranscoder.wf)
		.use(this.chromecastserver.wf);
	wfsa.forEach(function(wf){
		mw.use(wf);
	});
	return mw;
}

IPTVPlayer.prototype.getStatus = function(){
	return {
		index : this.current_channel_index,
		status : this.status,
		bitrate : this.bitrate
	};
}

IPTVPlayer.prototype.attach = function(cb){
	
	var player = new Player();
	player.attach(cb);
	
}

IPTVPlayer.prototype.stopChannel = function(){
	
	debug("stopping channel");
	var self = this;
	
	var wf = function(err,req,next){
	
		self.attach(function(err, p, ctxt) {
	        	if (err){
	        		debug('error stopping player ' + err);
					return next(err);
	        	}
				 
	        	debug('stop player');
			
	        	p.stop(function(err, info) {
	            	if (err) return next(err);
					ctxt.shutdown();
					next();
	            	debug('stopped %o', info);
	        });
			
	    });
	}
	
	var pack = {
		cmd: 'stop'
	};
	
	var mw = this._buildmw(wf);
	mw.run(null,pack,function(err,req){
		if(err) return debug('error middleware run %o',err);
		debug('channel stopped');
	});
}

IPTVPlayer.prototype.setVolume = function(volume){
	
	var self = this;
	
	this.attach(function(err, p, ctxt) {
	        if (err) return;
			
	        p.setVolume(volume);
			self.volume = volume;
			debug("set volume = " + volume);
	    });
}

IPTVPlayer.prototype.setMute = function(){
	
	this.setVolume(0);
}

module.exports = IPTVPlayer;