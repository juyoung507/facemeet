import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import './Testjang.css';
import { useParams } from 'react-router-dom';

const MeetingDetail = () => {
    const { meetingId } = useParams(); // URL에서 meetingId 가져오기
    const [roomUsers, setRoomUsers] = useState([]); // 방 내 사용자 목록 관리
    const myStreamRef = useRef(null);
    const peerConnections = useRef({}); // 피어 연결 관리
    const socketRef = useRef(null); // socket.io 객체
    const connectedUsers = useRef([]); // 연결된 사용자 목록
    const [messages, setMessages] = useState([]); // 채팅 메시지 목록

    useEffect(() => {
        if (!meetingId) {
            console.error("Error: meetingId is undefined or null");
            return;
        }

        // 서버에 연결하고 연결 여부를 확인
        socketRef.current = io("http://localhost:4000");

        socketRef.current.on("connect", () => {
            console.log("Connected to server, socket ID:", socketRef.current.id);
            socketRef.current.emit('join_room', meetingId);
        });

        socketRef.current.on("disconnect", () => {
            console.log("Disconnected from server");
        });

        // 방에 있는 사용자 목록을 받으면 업데이트 및 콘솔에 출력
        socketRef.current.on("room_users", (users) => {
            setRoomUsers(users);
            console.log(`Users in room "${meetingId}":, users`);
        });

        // 방 입장 시 서버에서 다른 사용자가 입장했을 때 실행
        socketRef.current.on("welcome", async ({ userId }) => {
            console.log(`User ${userId} joined room: ${meetingId}`);
            if (!connectedUsers.current.includes(userId) && myStreamRef.current) {
                connectedUsers.current.push(userId); // 연결된 사용자 추가
                const peerConnection = createPeerConnection(userId);
                addTracksToPeerConnection(peerConnection); // 스트림 트랙 추가
                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);
                console.log(`Sending offer to ${userId} in room: ${meetingId}`);
                socketRef.current.emit("offer", { offer, toUserId: userId, roomName: meetingId });
            }
        });

        // 서버에서 offer 수신 시 처리
        socketRef.current.on('offer', async ({ offer, userId }) => {
            console.log(`Received offer from ${userId} in room: ${meetingId}`);
            if (!connectedUsers.current.includes(userId)) {
                connectedUsers.current.push(userId); // 연결된 사용자 추가
                const peerConnection = createPeerConnection(userId);
                await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
                addTracksToPeerConnection(peerConnection); // 스트림 트랙 추가
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);
                console.log(`Sending answer to ${userId} in room: ${meetingId}`);
                socketRef.current.emit("answer", { answer, toUserId: userId, roomName: meetingId });
            }
        });

        // 서버에서 answer 수신 시 처리
        socketRef.current.on('answer', async ({ answer, userId }) => {
            console.log(`Received answer from ${userId} in room: ${meetingId}`);
            const peerConnection = peerConnections.current[userId];
            if (peerConnection) {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            } else {
                console.error(`Peer connection for ${userId} does not exist.`);
            }
        });

        // 서버에서 ICE 후보자 수신 시 처리
        socketRef.current.on('ice', async ({ ice, userId }) => {
            console.log(`Received ICE candidate from ${userId} in room: ${meetingId}`);
            const peerConnection = peerConnections.current[userId];
            if (peerConnection) {
                try {
                    await peerConnection.addIceCandidate(new RTCIceCandidate(ice));
                } catch (error) {
                    console.error(`Error adding received ICE candidate for ${userId}:, error`);
                }
            } else {
                console.error(`Peer connection for ${userId} does not exist.`);
            }
        });

        // 채팅 메시지 수신 시 처리
        socketRef.current.on("msg", (data) => {
            setMessages(prevMessages => [...prevMessages, { id: data.id, message: data.message }]);
        });

        // 사용자의 미디어 스트림 가져오기
        getMedia().then(() => {
            console.log("Media stream obtained.");
        }).catch((error) => {
            console.error("Error obtaining media stream:", error);
        });

        // 컴포넌트 언마운트 시 소켓 연결 정리
        return () => {
            socketRef.current.disconnect();
        };
    }, [meetingId]);

    // 사용자 미디어 스트림 가져오기
    const getMedia = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: true,
            });
            myStreamRef.current = stream; // 내 미디어 스트림 설정
            document.getElementById("myFace").srcObject = stream; // 내 비디오 화면 설정
        } catch (error) {
            console.error("미디어 장치 접근 중 오류 발생", error);
        }
    };

    // 피어 연결 생성
    const createPeerConnection = (userId) => {
        const peerConnection = new RTCPeerConnection();

        // ICE 후보자 이벤트 처리
        peerConnection.addEventListener("icecandidate", (event) => {
            if (event.candidate) {
                console.log(`Sending ICE candidate to ${userId}`);
                socketRef.current.emit("ice", { ice: event.candidate, roomName: meetingId, toUserId: userId });
            }
        });

        // 수신된 트랙(비디오) 추가
        peerConnection.addEventListener("track", (event) => {
            let peerFace = document.getElementById(`peerFace - ${userId}`);
            if (!peerFace) {
                peerFace = document.createElement("video");
                peerFace.id = `peerFace - ${userId}`;
                peerFace.autoplay = true;
                peerFace.playsInline = true;
                document.getElementById("peerContainer").appendChild(peerFace);
            }
            peerFace.srcObject = event.streams[0];
        });

        peerConnections.current[userId] = peerConnection;
        return peerConnection;
    };

    // 피어 연결에 트랙 추가
    const addTracksToPeerConnection = (peerConnection) => {
        if (myStreamRef.current) {
            myStreamRef.current.getTracks().forEach((track) => {
                peerConnection.addTrack(track, myStreamRef.current);
            });
        } else {
            console.error("myStreamRef.current is null, unable to add tracks.");
        }
    };

    // 채팅 메시지 전송 핸들러
    const sendMessage = (event) => {
        event.preventDefault();
        let data = document.getElementById("chatInput").value;
        socketRef.current.emit("input", data);
        document.getElementById("chatInput").value = "";
    };

    return (
        <div className="container-fluid">
            <div id="call">
                <video id="myFace" autoPlay playsInline height="150px" width="150px"></video>
                <div id="peerContainer">
                    {/* 연결된 사용자들의 비디오가 추가될 자리 */}
                </div>
            </div>
            <div>
                <ul className='peerBox'>
                    <p>Connected Users in Room</p>
                    {roomUsers.map(userId => (
                        <li key={userId}>{userId}</li>
                    ))}
                </ul>
                <div className="chatBox">
                    <div className='chat'>
                        <div className="messages">
                            {messages.map((msg, index) => (
                                <p key={index}><strong>{msg.id}:</strong> {msg.message}</p>
                            ))}
                        </div>
                    </div>
                    <div className='sendBtn'>
                        <form onSubmit={sendMessage}>
                            <input
                                type="text"
                                id="chatInput"
                                className="form-control mb-3"
                                placeholder="Enter your message"
                                autoComplete="off"
                            />
                            <button type="submit" className="btn btn-primary">Send</button>
                        </form>
                    </div>
                </div>
                <div className='scoreBox'>점수</div>
            </div>
        </div>
    );
};

export default MeetingDetail;