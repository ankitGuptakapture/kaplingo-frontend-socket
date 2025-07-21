interface RoomStatusProps {
  isJoined: boolean;
  roomId: string;
}

export function RoomStatus({ isJoined, roomId }: RoomStatusProps) {
  return (
    <div className="w-full text-center mb-4">
      {isJoined ? (
        <div className="inline-flex items-center bg-green-100 text-green-800 text-sm font-medium px-3 py-1 rounded-full">
          <span className="w-2 h-2 mr-2 bg-green-500 rounded-full animate-pulse"></span>
          Joined room: {roomId}
        </div>
      ) : (
        <div className="inline-flex items-center bg-yellow-100 text-yellow-800 text-sm font-medium px-3 py-1 rounded-full">
          <span className="w-2 h-2 mr-2 bg-yellow-500 rounded-full"></span>
          Disconnected from room
        </div>
      )}
    </div>
  );
} 