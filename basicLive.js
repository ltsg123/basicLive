// create Agora client
var client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
var localTracks = {
  videoTrack: null,
  audioTrack: null,
};
var remoteUsers = {};
// Agora client options
var options = {
  appid: null,
  channel: null,
  uid: null,
  token: null,
  role: "host", // host or audience
  audienceLatency: 2,
};

// the demo can auto join channel with params in url
$(() => {
  var urlParams = new URL(location.href).searchParams;
  options.appid = urlParams.get("appid");
  options.channel = urlParams.get("channel");
  options.token = urlParams.get("token");
  options.uid = urlParams.get("uid");
  if (options.appid && options.channel) {
    $("#uid").val(options.uid);
    $("#appid").val(options.appid);
    $("#token").val(options.token);
    $("#channel").val(options.channel);
    $("#join-form").submit();
  }
});

$("#host-join").click(function (e) {
  options.role = "host";
});

$("#join-form").submit(async function (e) {
  e.preventDefault();
  $("#host-join").attr("disabled", true);
  try {
    options.appid = $("#appid").val();
    options.token = $("#token").val();
    options.channel = $("#channel").val();
    options.uid = Number($("#uid").val());
    await join();
    if (options.role === "host") {
      $("#success-alert a").attr(
        "href",
        `index.html?appid=${options.appid}&channel=${options.channel}&token=${options.token}`
      );
      if (options.token) {
        $("#success-alert-with-token").css("display", "block");
      } else {
        $("#success-alert a").attr(
          "href",
          `index.html?appid=${options.appid}&channel=${options.channel}&token=${options.token}`
        );
        $("#success-alert").css("display", "block");
      }
    }
  } catch (error) {
    console.error(error);
  } finally {
    $("#leave").attr("disabled", false);
    $("#reconnect").attr("disabled", false);
  }
});

$("#leave").click(function (e) {
  leave();
});

$("#reconnect").click(function (e) {
  console.log("reconnect----------");
  // close pc
  client._p2pChannel.disconnectForReconnect();
  // close websocket
  client._gateway.signal.websocket.websocket.close();
});

async function join() {
  client.on("user-published", handleUserPublished);
  client.on("user-unpublished", handleUserUnpublished);
  // join the channel
  options.uid = await client.join(
    options.appid,
    options.channel,
    options.token || null,
    options.uid || null
  );

  // create local audio and video tracks
  localTracks.audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
  localTracks.videoTrack = await AgoraRTC.createCameraVideoTrack();
  // play local video track
  localTracks.videoTrack.play("local-player");
  $("#local-player-name").text(`localTrack(${options.uid})`);
  // publish local tracks to channel
  await client.publish(Object.values(localTracks));
  console.log("publish success");
}

async function leave() {
  for (trackName in localTracks) {
    var track = localTracks[trackName];
    if (track) {
      track.stop();
      track.close();
      localTracks[trackName] = undefined;
    }
  }

  // remove remote users and player views
  remoteUsers = {};
  $("#remote-playerlist").html("");
  $("#remote-playerlist2").html("");

  // leave the channel
  await client.leave();

  $("#local-player-name").text("");
  $("#host-join").attr("disabled", false);
  $("#audience-join").attr("disabled", false);
  $("#leave").attr("disabled", true);
  $("#reconnect").attr("disabled", true);
  console.log("client leaves channel success");
}

async function subscribe(user, mediaType) {
  const uid = user.uid;
  // subscribe to a remote user
  await client.subscribe(user, mediaType);
  console.log("subscribe success");
  if (mediaType === "video") {
    const player = $(`
      <div id="player-wrapper-${uid}">
        <p class="player-name">remoteUser(${uid})</p>
        <div id="player-${uid}" class="player"></div>
      </div>
    `);
    $("#remote-playerlist").append(player);
    user.videoTrack.play(`player-${uid}`, { fit: "contain" });

    // Custom Rendering
    const originMediaStreamTrack = user.videoTrack.getMediaStreamTrack();
    const stream = new MediaStream([originMediaStreamTrack]);

    const player2 = $(`
    <div id="player-wrapper-${uid}">
      <p class="player-name">remoteUser(${uid}) （Custom Rendering）</p>
      <video id="custom-player" muted autoplay class="player"></video>
    </div>
  `);
    $("#remote-playerlist2").append(player2);
    $("#custom-player")[0].srcObject = stream;

    user.videoTrack.on("track-updated", (track) => {
      console.log("track-updated", track);
      $("#custom-player")[0].srcObject = new MediaStream([track]);
    });
  }
  if (mediaType === "audio") {
    user.audioTrack.play();
  }
}

function handleUserPublished(user, mediaType) {
  //print in the console log for debugging
  console.warn('"user-published" event for remote users is triggered.');

  const id = user.uid;
  remoteUsers[id] = user;
  subscribe(user, mediaType);
}

function handleUserUnpublished(user, mediaType) {
  //print in the console log for debugging
  console.log('"user-unpublished" event for remote users is triggered.');

  if (mediaType === "video") {
    const id = user.uid;
    delete remoteUsers[id];
    $(`#player-wrapper-${id}`).remove();
  }
}
