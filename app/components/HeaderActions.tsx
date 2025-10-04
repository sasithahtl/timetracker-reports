'use client';

import { useState } from 'react';
import ChangePasswordDialog from './ChangePasswordDialog';
import LogoutButton from './LogoutButton';

export default function HeaderActions() {
  const [changeOpen, setChangeOpen] = useState(false);
  return (
    <div className="flex justify-end gap-2">
      <button
        onClick={() => setChangeOpen(true)}
        className="inline-flex items-center justify-center bg-white hover:bg-gray-50 text-gray-700 font-medium py-2 px-4 rounded-lg border border-gray-300 transition-colors"
      >
        Change password
      </button>
      <LogoutButton />
      <ChangePasswordDialog open={changeOpen} onOpenChange={setChangeOpen} />
    </div>
  );
}


