document.addEventListener('DOMContentLoaded', async () => {
    const socket = new WebSocket(`ws://${window.location.host}`);
    let currentRoomId = null;

    const roomList = document.getElementById('room-list');
    const userList = document.getElementById('user-list');
    const messagesContainer = document.getElementById('messages');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');

    async function loadRooms() {
        const res = await fetch('/api/rooms');
        const rooms = await res.json();
        roomList.innerHTML = '';
        rooms.forEach(room => {
            const li = document.createElement('li');
            li.textContent = room.name;
            li.onclick = () => joinRoom(room.id);
            roomList.appendChild(li);
        });
    }

    async function loadUsers() {
        const res = await fetch('/api/users');
        const users = await res.json();
        userList.innerHTML = '';
        users.forEach(user => {
            const li = document.createElement('li');
            li.textContent = user.nickname; // используем никнейм
            li.onclick = () => createPrivateRoom(user.nickname);
            userList.appendChild(li);
        });
    }

    async function joinRoom(roomId) {
        currentRoomId = roomId;
        messagesContainer.innerHTML = '';

        const res = await fetch(`/api/rooms/${roomId}/messages`);
        const messages = await res.json();
        messages.forEach(addMessageToUI);

        socket.send(JSON.stringify({ type: 'join', roomId }));
    }

    async function createPrivateRoom(nickname) {
        const res = await fetch('/api/rooms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nickname })
        });
        const room = await res.json();
        joinRoom(room.id);
    }

    function addMessageToUI(message) {
        const div = document.createElement('div');
        div.textContent = `${message.senderNickname}: ${message.text}`;
        messagesContainer.appendChild(div);
    }

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'message') {
            addMessageToUI(data.message);
        }
    };

    sendButton.onclick = () => {
        if (!currentRoomId || !messageInput.value.trim()) return;
        socket.send(JSON.stringify({ type: 'message', roomId: currentRoomId, text: messageInput.value.trim() }));
        messageInput.value = '';
    };

    loadRooms();
    loadUsers();
});
