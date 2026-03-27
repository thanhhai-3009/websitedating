import React, { useState } from 'react';
import GroupDating from '@/components/GroupDating';
import { Button } from '@/components/ui/button';

const HelpContent = () => (
  <div className="bg-white p-4 rounded-md shadow-sm">
    <h3 className="text-lg font-semibold mb-2">Hẹn hò nhóm — Tìm & Tham gia</h3>
    <ul className="list-disc pl-5 text-sm space-y-1">
      <li>Hẹn hò nhóm cho phép bạn tạo hoặc tham gia buổi gặp nhóm theo sở thích (ăn uống, du lịch, đi chơi).</li>
      <li>Truy cập: Menu → Hẹn hò nhóm (Groups) hoặc vào trang Khám phá → mục 'Nhóm'.</li>
      <li>Tạo nhóm: Bấm 'Create Group' (chỉ host đã xác minh).</li>
      <li>Tham gia: Mở nhóm và bấm 'Join'. Hệ thống kiểm tra chỗ trống ngay lập tức — nếu đầy sẽ hiển thị 'FULL'.</li>
      <li>Nếu không thấy tính năng: cập nhật app lên phiên bản mới nhất hoặc liên hệ Hỗ trợ.</li>
    </ul>
  </div>
);

const GroupsPage: React.FC = () => {
  const [showHelp, setShowHelp] = useState(false);
  return (
    <div className="pt-24 pb-8">
      <div className="container mx-auto px-4 mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Hẹn hò nhóm</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => setShowHelp((s) => !s)}>{showHelp ? 'Hide' : 'Help'}</Button>
        </div>
      </div>

      <div className="container mx-auto px-4">
        {showHelp && <HelpContent />}
        <div className="mt-6">
          <GroupDating />
        </div>
      </div>
    </div>
  );
};

export default GroupsPage;
