/**
 * @jsx React.DOM
 */

// Polyfills

navigator.getMedia = (
	navigator.getUserMedia ||
	navigator.webkitGetUserMedia ||
	navigator.mozGetUserMedia ||
	navigator.msGetUserMedia
);

window.URL || (window.URL = window.webkitURL);
window.audioContext || (window.audioContext = window.webkitAudioContext);

if (!Date.now) {
	Date.now = function now() {
		return new Date().getTime();
	};
}

// Config

Pusher.log = window.console.log.bind(window.console);

// Functions

function trace(message) {
  console.log(message);
}

function once(fn) {
	return function () {
		if (fn.hasRun) return;
		fn.hasRun = true;
		fn.apply(this, arguments);
	};
}

function merge(target /*...*/) {
	var others = Array.prototype.slice.call(arguments, 1), i, l;

	others.forEach(function(obj) {
		for (key in obj) {
			target[key] = obj[key];
		}
	});

	return target;
}

function getNick() {
	return document.body.getAttribute("data-nick");
}

function getUserId() {
	return document.body.getAttribute("data-user-id");
}

function getMugShot(stream, success, error, binding) {
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

		success.call(binding, canvas.toDataURL("image/png"));
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

function rateLimited(num_per_sec, proc) {
	var tid = null, buffer = [];
	return function() {
		var self=this;
		buffer.push(Array.prototype.slice.call(arguments));
		if (!tid) {
			tid = setInterval(function() {
				var args = buffer.shift();
				proc.apply(self, args);
				if (buffer.length === 0) {
					clearTimeout(tid);
					tid = null;
				}
			}, 1000 / (num_per_sec - 1));
		}
	}
}

function MessagingService() {
	
}

merge(MessagingService.prototype, {
	foo: function() {
		
	}

});

// Components


var Portrait = React.createClass({
	handleClick: function() {
		this.props.onClick(this.props.user);
	},
	
	render: function() {
		if (this.props.live) {
			return (
				<div className="portrait" onClick={this.handleClick}>
					<div className="nick" label={this.props.user.id}>{this.props.user.nick}</div>
					<video src={this.props.user.stream && window.URL.createObjectURL(this.props.user.stream)} autoplay height="160" />
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
	},
	handleOtherClick: function() {
		console.log("Ping", this, arguments);
	},
	getSelfMugshot: function() {
		if (!this.state.self.stream) return;
		getMugShot(this.state.self.stream,
			function(newImage) {
				var newSelf = merge({}, this.state.self, {
					image: newImage,
				});

				console.log("new self", newSelf);

				this.setState({self: newSelf});	
			},
			function(error) {
				console.log("mugshot error", error);
			},
			this
		);
	},
	getMediaStream: function() {
		navigator.getMedia({
				video: { mandatory: { minWidth: 160, minHeight: 160 }},
				audio: true
			},
			function(stream) {
				var newSelf = merge({}, this.state.self, {
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
		
		if (stream.getVideoTracks().length > 0) {
			trace("Using video device: " + stream.getVideoTracks()[0].label);
		}
		if (stream.getAudioTracks().length > 0) {
			trace("Using audio device: " + stream.getAudioTracks()[0].label);
		}

		function setLocalAndSendMessage(desc) {
			var self = this.state.self;
			
			console.log("offer", desc);
			pc.setLocalDescription(desc);
			this.trigger("client-offer", {user_id: self.id, sdp: desc.sdp});
			// trace("Offer from pc1 \n" + desc.sdp);
			// pc2.setRemoteDescription(desc);
			// pc2.createAnswer(gotDescription2);
		};

		function fail(err) {
			console.log("create offer error", err)
		}

		pc.addStream(stream);
		pc.createOffer(setLocalAndSendMessage.bind(this), fail, {});
	},
	bind: function(event_name, cb, binding) {
		this.state.channel.bind(event_name, cb.bind(binding || this));
	},
	trigger: rateLimited(10, function(event_name, data) {
		this.state.channel.trigger(event_name, data);
	}),
	
	getInitialState: function() {
		var pcConfig = {iceServers: [{urls: "stun:stun.l.google.com:19302"}]};
		var pcConstraints = {"optional": []};

		var self = {
			id: getUserId(),
			nick: getNick(),
			image: "unknown.gif",
			stream: null,
			live: false,
		};
		return {
			channel: pusher.subscribe("presence-rtc", {nick: self.nick}),
			pc: new RTCPeerConnection(pcConfig, pcConstraints),
			self: self,
			others: [],
		};
	},
	componentWillMount: function() {
		var pc = this.state.pc;

		this.bind("pusher:member_added", function(data) {
			console.log("Member added", data);
		});

		this.bind("pusher:member_removed", function(data) {
			console.log("Member removed", data);
		});

		this.bind("pusher:subscription_succeeded", function() {
			console.log("user", this.state.channel.members.me);

			this.getMediaStream();

			pc.onicecandidate = function(event) {
				if (event.candidate) {
					var self = this.state.self;
					console.log("ice-candidate", event);
					this.trigger("client-candidate", {user_id: self.id, candidate: event.candidate});
				}
			}.bind(this);
			

			// Broadcast yourself
			// var self = this.state.self;
			// this.trigger("client-info", {id: self.id, nick: self.nick, image: self.image });
		});
		
		this.bind("client-info", function(data) {
			var self = this.state.self;
			if (self.id === data.id) return;
			
			var newOthers = this.state.others.concat([{
				id: data.id,
				nick: data.nick,
				image: "unknown.gif",
				stream: null,
				live: false,
			}])

			// Reply with our own infos
			this.trigger("client-info", { id: self.id, nick: self.nick, image: self.image });
		});
		
		this.bind("client-candidate", function(data) {
			var self = this.state.self;
			if (self.id === data.user_id) return;
			
			console.log("data", data);
			pc.addIceCandidate(new RTCIceCandidate(data.candidate));
		});
		
		this.bind("client-offer", function(data) {
			var self = this.state.self;
			if (self.id === data.user_id) return;
			
			pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
		});
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
	document.getElementById("content")
);
