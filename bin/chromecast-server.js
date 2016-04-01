/*

CHROMECAST SERVER

opens a http server to send video streaming to the chromecast.

*/

var http = require('http');
var debug = require('debug')('iptvplayer:ccsever');


var ccserver = function(){
	
	this.port = null;
	this.server = null;
	
}

ccserver.prototype.wf = function(){
	
	return function(err,req,next){
		
		if(err) return next(err);
		
		if(!req) return next(new Error('request undefined'));
		
		switch(req.cmd){
			
			case 'play':
				
				this.server = http.createServer().listen(req.chromecastport);
				debug('chromecast server listening on port ' + port);
				
				var transcoder = req.transcoder;
				var url = req.url;
				var self = this;
	
				this.server.on('request',function(req,res) {
		
					debug("request sent by chromecast");
	
    				res.writeHead(200, {
      	  	  		  'Access-Control-Allow-Origin': '*'
   	 				});
	
					//pipe stdout to res
    				transcoder.stream(url).once('data',function(chunk){
						debug('trasmission');
						next();
    				}).pipe(res);
				});
	
				this.server.on('error',function(err){
					debug('error - socket closed');
				});
				
				break;
				
			case 'stop':
				
				//close the chromecast server
				this.server.close();
				next();
				
				break;
				
			case default:
				
				next(new Error('not valid command'));
			}	
	}
}

module.exports = ccserver;