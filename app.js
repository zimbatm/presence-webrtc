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

function once(fn) {
	return function () {
		if (fn.hasRun) return;
		fn.hasRun = true;
		fn.apply(this, arguments);
	}
}

function getMugShot(success, error) {
	navigator.getMedia(
		{ video: true }, //, audio: true },
		function(stream) {
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
		},
		error
	);
	
}

var Portrait = React.createClass({
	handleClick: function() {
		this.props.onClick(this.props.nick);
	},
	render: function() {
		return (
			<div className="portrait" onClick={this.handleClick}>
				<div className="nick">{this.props.nick}</div>
				<img src={this.props.image} height="160" />
			</div>
		);
	}
});

var PersonList = React.createClass({
	handleLiveToggle: function() {
		console.log("Toggle");
	},
	render: function() {
		var portraitNodes = this.props.persons.map(function (person) {
			return <Portrait nick={person.nick} image={person.image} />
		});
		return (
			<div className="personList">
				<Portrait nick={this.props.self.nick} image={this.props.self.image} onClick={this.handleLiveToggle} />
				{portraitNodes}
			</div>
		)
	}
});

var PresenceBox = React.createClass({
	getSelfMugshot: function() {
		var self = this;
		getMugShot(
			function(newImage) {
				var newSelf = {
					nick: self.state.self.nick,
					image: newImage
				};

				console.log("new self", newSelf);

				self.setState({self: newSelf});	
			},
			function(error) {
				console.log("mugshot error", error);
			}
		);
	},
	
	getInitialState: function() {
		var self = {
			nick: "zimbatm",
			image: "unknown.gif",
		};
		return {
			self: self,
			others: [],
		};
	},
	componentWillMount: function() {
		this.getSelfMugshot();
	},
	render: function() {
		return (
			<div className="presenceBox">
				<PersonList self={this.state.self} persons={this.state.others} />
			</div>
		);
	}
})

React.renderComponent(
	<PresenceBox />,
	document.getElementById('content')
);
