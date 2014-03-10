/**
 * @jsx React.DOM
 */

navigator.getMedia = (
	navigator.getUserMedia ||
	navigator.webkitGetUserMedia ||
	navigator.mozGetUserMedia ||
	navigator.msGetUserMedia
);

window.URL || (window.URL = window.webkitURL);
window.audioContext || (window.audioContext = window.webkitAudioContext);

Pusher.log = window.console.log.bind(window.console);

var pusher = new Pusher('a1ef4d95b2ea5f33a5b9');
window.sessionStorage || (window.sessionStorage = {});

function once(fn) {
	return function () {
		if (fn.hasRun) return;
		fn.hasRun = true;
		fn.apply(this, arguments);
	}
}

function merge(obj1, obj2) {
	var o = {}, key;
	for (key in obj1) {
		o[key] = obj1[key];
	}
	for (key in obj2) {
		o[key] = obj2[key];
	}
	return o;
}

function getNick() {
	var nick = window.sessionStorage["nick"];
	if (nick) return nick;
	window.sessionStorage["nick"] = prompt("What's your nick ?");
	return window.sessionStorage["nick"];
}

function getMugShot(stream, success, error) {
	var canvas = document.createElement("canvas");
	var vid = document.createElement("video");
	vid.autoplay = true;
	vid.src = window.URL.createObjectURL(stream);

	//document.body.appendChild(vid);
	
	vid.onplaying = once(function() {
		vid.pause(); // No need
		
		canvas.width = vid.videoWidth;
		canvas.height = vid.videoHeight;
		canvas.getContext("2d").drawImage(vid, 0, 0);

		success(canvas.toDataURL("image/png"));
	});
	vid.onerror = error;
}

function gotLocalIceCandidate(event){
	console.log("local ice candidate", event);
	if (event.candidate) {
		remotePeerConnection.addIceCandidate(new RTCIceCandidate(event.candidate));
		trace("Local ICE candidate: \n" + event.candidate.candidate);
	}
}

function gotRemoteIceCandidate(event){
	console.log("remote ice candidate", event);
	if (event.candidate) {

		localPeerConnection.addIceCandidate(new RTCIceCandidate(event.candidate));
		trace("Remote ICE candidate: \n " + event.candidate.candidate);
	}
}

function gotRemoteStream(event){
	console.log("remove stream", event);
	remoteVideo.src = URL.createObjectURL(event.stream);
	trace("Received remote stream");
}

function gotLocalDescription(event){
	console.log("local description", event);
}

function handleError() {
	console.log("RTC error", arguments);
}


var Portrait = React.createClass({
	handleClick: function() {
		this.props.onClick(this.props.nick);
	},
	
	render: function() {
		if (this.props.live) {
			return (
				<div className="portrait" onClick={this.handleClick}>
					<div className="nick">{this.props.nick}</div>
					<video src={this.props.stream && window.URL.createObjectURL(this.props.stream)} autoplay height="160" />
				</div>
			);
		} else {
			return (
				<div className="portrait" onClick={this.handleClick}>
					<div className="nick">{this.props.nick}</div>
					<img src={this.props.image} height="160" />
				</div>
			);
		}
	}
});

var PresenceBox = React.createClass({
	handleSelfClick: function() {
		console.log("Toggle", this, arguments);
		this.getSelfMugshot()
		//this.setState({self: merge(this.state.self, {live: !this.state.self.live})});
	},
	handleOtherClick: function() {
		console.log("Ping", this, arguments);
	},
	getSelfMugshot: function() {
		if (!this.state.self.stream) return;
		getMugShot(this.state.self.stream,
			function(newImage) {
				var newSelf = merge(this.state.self, {
					image: newImage,
				});

				console.log("new self", newSelf);

				this.setState({self: newSelf});	
			}.bind(this),
			function(error) {
				console.log("mugshot error", error);
			}
		);
	},
	getMediaStream: function() {
		navigator.getMedia({
				video: { mandatory: { minWidth: 160, minHeight: 160 }},
				audio: true
			},
			function(stream) {
				var newSelf = merge(this.state.self, {
					stream: stream,
				});

				console.log("new self", newSelf);

				this.setState({self: newSelf}, function() {
					this.getSelfMugshot();
					this.initiateCall()
				});
			}.bind(this), function(err) {
				console.log("getMedia error", err);
			}
		);
	},
	initiateCall: function() {
		var stream = this.state.self.stream;
		var pc = this.state.pc;
		var channel = this.state.channel;
		
		if (stream.getVideoTracks().length > 0) {
			trace('Using video device: ' + stream.getVideoTracks()[0].label);
		}
		if (stream.getAudioTracks().length > 0) {
			trace('Using audio device: ' + stream.getAudioTracks()[0].label);
		}

		function setLocalAndSendMessage(desc) {
			console.log("offer", desc);
			pc.setLocalDescription(desc);
			channel.trigger("client-offer", {sdp: desc.sdp});
			// trace("Offer from pc1 \n" + desc.sdp);
			// pc2.setRemoteDescription(desc);
			// pc2.createAnswer(gotDescription2);
		}

		function fail(err) {
			console.log("create offer error", err)
		}

		pc.addStream(stream);
		pc.createOffer(setLocalAndSendMessage, fail, {});
	},
	
	getInitialState: function() {
		var servers = {
			iceServers: [{
				url: "stun:stun.l.google.com:19302"
			}]
		};

		var contraints = {};

		var self = {
			nick: getNick(),
			image: "unknown.gif",
			stream: null,
			live: false,
		};
		return {
			constraints: contraints,
			channel: pusher.subscribe('rtc', {nick: self.nick}),
			pc: new RTCPeerConnection(servers, contraints),
			self: self,
			others: [],
		};
	},
	componentWillMount: function() {
		var pc = this.state.pc;
		var channel = this.state.channel;
		
		
		pc.onicecandidate = function(event) {
			if (event.candidate) {
				console.log("ice-candidate", event);
				channel.trigger("client-candidate", {candidate: event.candidate});
			}
		};
		
		channel.bind('pusher:subscription_succeeded', function() {
			// Broadcast yourself
			var self = this.state.self;
			channel.trigger('client-info', { nick: self.nick, image: self.image });
		}.bind(this));
		
		channel.bind('client-info', function(data) {
			var self = this.state.self;
			
			var newOthers = this.state.others.concat([{
				nick: data.nick,
				image: "unknown.gif",
				stream: null,
				live: false,
			}])

			// Reply with our own infos
			channel.trigger('client-info', { nick: self.nick, image: self.image });
		}.bind(this));
		
		channel.bind('client-candidate', function(data) {
			console.log("data", data);
			pc.addIceCandidate(new RTCIceCandidate(data.candidate));
		});
		
		channel.bind('client-offer', function(data) {
			pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
		});
		this.getMediaStream();
		// setInterval(this.getSelfMugshot.bind(this), 2000);
	},
	render: function() {
		var portraitNodes = this.state.others.map(function (person) {
			return <Portrait nick={person.nick} image={person.image} live={person.live} onClick={this.handleOtherClick} />
		});
		return (
			<div className="presenceBox">
				<Portrait nick={this.state.self.nick} image={this.state.self.image} live={this.state.self.live} onClick={this.handleSelfClick} />
				{portraitNodes}
			</div>
		);
	}
})

React.renderComponent(
	<PresenceBox />,
	document.getElementById('content')
);
