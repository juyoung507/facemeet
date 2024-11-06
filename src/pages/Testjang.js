import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import './Testjang.css';

const Testjang = () => {
  const [roomName, setRoomName] = useState(''); // 방 이름 상태 관리
  const [roomUsers, setRoomUsers] = useState([]); // 방 내 사용자 목록 관리
  const myStreamRef = useRef(null);
  const peerConnections = useRef({}); // 피어 연결 관리
  const socketRef = useRef(null); // socket.io 객체
  const connectedUsers = useRef([]); // 연결된 사용자 목록

  const handleFormSubmit = async (event) => {
    event.preventDefault();
    const input = event.target.querySelector("input");

    if (!input.value.trim()) {
      console.log("Room name cannot be empty!");
      return;  // 방 이름이 비어 있으면 방 입장을 시도하지 않음
    }

    const enteredRoomName = input.value;
    setRoomName(enteredRoomName);

    console.log("Joining room:", enteredRoomName);
    await startMedia(); // 미디어 시작 후 방 입장
    socketRef.current.emit('join_room', enteredRoomName); // 방 이름 전송
    input.value = "";
  };

  useEffect(() => {
    // 서버에 연결하고 연결 여부를 확인
    socketRef.current = io("http://localhost:4000");

    socketRef.current.on("connect", () => {
      console.log("Connected to server, socket ID:", socketRef.current.id);
    });

    socketRef.current.on("disconnect", () => {
      console.log("Disconnected from server");
    });

    // 방에 있는 사용자 목록을 받으면 업데이트 및 콘솔에 출력
    socketRef.current.on("room_users", (users) => {
      setRoomUsers(users);
      console.log(`Users in room "${roomName}":`, users);
    });

    // 방 입장 시 서버에서 다른 사용자가 입장했을 때 실행
    socketRef.current.on("welcome", async ({ userId, roomName: joinedRoomName }) => {
      console.log(`User ${userId} joined room: ${joinedRoomName}`);
      if (joinedRoomName === roomName && !connectedUsers.current.includes(userId)) {
        connectedUsers.current.push(userId); // 연결된 사용자 추가
        const peerConnection = createPeerConnection(userId);
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        console.log(`Sending offer to ${userId} in room: ${roomName}`);
        socketRef.current.emit("offer", offer, roomName, userId); // 특정 사용자에게 offer 전송
      }
    });

    // 서버에서 offer 수신 시 처리
    socketRef.current.on('offer', async ({ offer, userId, roomName: offerRoomName }) => {
      console.log(`Received offer from ${userId} in room: ${offerRoomName}`);
      if (offerRoomName === roomName && !connectedUsers.current.includes(userId)) { // 같은 방인지 확인
        connectedUsers.current.push(userId); // 연결된 사용자 추가
        const peerConnection = createPeerConnection(userId);
        await peerConnection.setRemoteDescription(offer);
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        console.log(`Sending answer to ${userId} in room: ${roomName}`);
        socketRef.current.emit("answer", answer, roomName, userId); // 특정 사용자에게 answer 전송
      }
    });

    // 서버에서 answer 수신 시 처리
    socketRef.current.on('answer', async ({ answer, userId, roomName: answerRoomName }) => {
      console.log(`Received answer from ${userId} in room: ${answerRoomName}`);
      if (answerRoomName === roomName) {  // 같은 방인지 확인
        const peerConnection = peerConnections.current[userId];
        await peerConnection.setRemoteDescription(answer);
      }
    });

    // 서버에서 ICE 후보자 수신 시 처리
    socketRef.current.on('ice', async ({ ice, userId, roomName: iceRoomName }) => {
      console.log(`Received ICE candidate from ${userId} in room: ${iceRoomName}`);
      if (iceRoomName === roomName) {
          const peerConnection = peerConnections.current[userId];
          if (peerConnection) {
            try {
              await peerConnection.addIceCandidate(ice);
            } catch (error) {
              console.error(`Error adding received ICE candidate for ${userId}:`, error);
            }
          } else {
              console.error(`Peer connection for ${userId} does not exist.`);
          }
      }
    });

    // 컴포넌트 언마운트 시 소켓 연결 정리
    return () => {
      socketRef.current.disconnect();
    };
  }, [roomName]);

  // 사용자 미디어 스트림 가져오기
  const getMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      myStreamRef.current = stream;  // 내 미디어 스트림 설정
      document.getElementById("myFace").srcObject = stream;  // 내 비디오 화면 설정
    } catch (error) {
      console.error("미디어 장치 접근 중 오류 발생", error);
    }
  };

  const createPeerConnection = (userId) => {
    const peerConnection = new RTCPeerConnection();

    // ICE 후보자 이벤트 처리
    peerConnection.addEventListener("icecandidate", (event) => {
      if (event.candidate) {
        console.log(`Sending ICE candidate to ${userId}`);
        socketRef.current.emit("ice", event.candidate, roomName, userId);
      }
    });

    // 수신된 트랙(비디오) 추가
    peerConnection.addEventListener("track", (event) => {
      let peerFace = document.getElementById(`peerFace-${userId}`);
      if (!peerFace) {
        peerFace = document.createElement("video");
        peerFace.id = `peerFace-${userId}`;
        peerFace.autoplay = true;
        document.getElementById("peerContainer").appendChild(peerFace);
      }
      peerFace.srcObject = event.streams[0];
    });

    // 스트림 객체가 존재하는지 확인 후 트랙 추가
    if (myStreamRef.current) {
      myStreamRef.current.getTracks().forEach((track) => {
        peerConnection.addTrack(track, myStreamRef.current);
      });
    } else {
      console.error("myStreamRef.current is null, unable to add tracks.");
    }

    peerConnections.current[userId] = peerConnection;
    return peerConnection;
  };

  // 방 입장 시 미디어 시작 및 방 입장 요청
  const startMedia = async () => {
    await getMedia();
    document.getElementById("welcome").hidden = true;
    document.getElementById("call").hidden = false;
    socketRef.current.emit('join_room', roomName); // 방 입장 이벤트 서버로 전송
  };

  return (
    <div className="container-fluid">
      <div id="welcome">
        <form id="welcomeForm" onSubmit={handleFormSubmit}>
          <input type="text" placeholder="room name" required />
          <button>Enter Room</button>
        </form>
      </div>
      <div id="call" hidden>
        <video id="myFace" autoPlay playsInline height="150px" width="150px"></video>
        <div id="peerContainer">
          {/* 연결된 사용자들의 비디오가 추가될 자리 */}
        </div>
      </div>
      <div className='chat'>
        <h3>Connected Users in Room</h3>
        <ul>
          {roomUsers.map(userId => (
            <li key={userId}>{userId}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default Testjang;