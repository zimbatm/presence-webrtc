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

var CommentBox = React.createClass({
	render: function() {
		return (
			<div className="commentBox">
				Hello, world! I am a CommentBox.
			</div>
		);
	}
});

React.renderComponent(
	<CommentBox />,
	document.getElementById('content')
);



// var portrait = document.getElementById("portrait");
// var portraitVid = document.getElementById("portraitVid");
// var b_context = portrait.getContext("2d");
// var snapshotBtn = document.getElementById("snapshot");

// portraitVid.autoplay = true;
// snapshotBtn.onclick = getPortrait;

// navigator.getMedia(
//	{ video: true },// audio: true },
//	function(stream) {
//		portraitVid.src = window.URL.createObjectURL(stream);
//	},
//	console.log
// );

// function getPortrait() {
//	portrait.width = portraitVid.clientWidth;
//	portrait.height = portraitVid.clientHeight;
//	b_context.drawImage(
//		portraitVid,
//		0,
//		0,
//		portrait.width,
//		portrait.height
//	);
// }
