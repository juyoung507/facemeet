import React, { useState, useEffect } from "react";
import Layout from '../components/Layout';
import '../components/Profile.css';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function Profile() {
    const userId = localStorage.getItem('userId');
    const accessToken = localStorage.getItem('token'); // 토큰 가져오기
    const navigate = useNavigate();
    const [user, setUser] = useState({
        nickname: '',
        email: '',
        username: ''
    });
    const [profilePicture, setProfilePicture] = useState(null);
    const [profilePictureFile, setProfilePictureFile] = useState(null);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                // 인증 토큰을 포함하여 사용자 정보를 가져옵니다.
                const response = await axios.get(`http://localhost:4000/mypage?userId=${userId}`, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                    },
                });

                // response.data를 통해 사용자 정보를 설정합니다.
                const data = response.data;
                setUser({
                    nickname: data.nickname,
                    email: data.email,
                    username: data.email.split('@')[0]
                });
            } catch (error) {
                console.error('Error fetching data:', error);
            }
        };
        fetchUser();
    }, [userId, accessToken]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setUser(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSave = async () => {
        try {
            const formData = new FormData();
            formData.append('nickname', user.nickname);
            formData.append('email', user.email);
            if (profilePictureFile) {
                formData.append('profileImage', profilePictureFile);
            }

            // 사용자 정보를 업데이트하기 위해 PATCH 요청을 보냅니다.
            const response = await fetch(`/api/users/${userId}/`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
                body: formData,
            });

            const data = await response.json();
            setProfilePicture(data.profileImage);
            alert('정보가 업데이트 되었습니다.');
        } catch (error) {
            console.error('사용자 정보를 업데이트하는데 실패했습니다:', error);
            alert('정보 업데이트에 실패하였습니다.');
        }
    };

    const handleProfilePictureChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setProfilePictureFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setProfilePicture(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <Layout>
            <div className="Profile">
                <div className='header'></div>
                <div className='picture'>
                    {profilePicture ? (
                        <img src={profilePicture} alt="Profile" className="profile-img" />
                    ) : (
                        <div className="profile-placeholder"></div>
                    )}
                </div>
                <h1>{user.nickname}</h1>
                <input
                    type="file"
                    id="profilePictureInput"
                    style={{ display: 'none' }}
                    onChange={handleProfilePictureChange}
                />
                <button className="picture-button" onClick={() => document.getElementById('profilePictureInput').click()}>
                    사진 변경
                </button>
                <button className="save" onClick={handleSave}>저장</button>
                <div className='information'>
                    <label>아이디:</label>
                    <input type="text" className="text-input" value={user.username} readOnly /><br></br>
                    <label>닉네임:</label>
                    <input type="text" name="nickname" className="text-input" value={user.nickname} onChange={handleInputChange} /><br></br>
                    <label>이메일:</label>
                    <input type="text" name="email" className="text-input" value={user.email} onChange={handleInputChange} /><br></br>
                </div>
            </div>
        </Layout>
    );
}

export default Profile;
