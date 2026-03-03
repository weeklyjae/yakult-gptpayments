import React from 'react'

function Header({ user, isAdmin, onSignOut }) {
  return (
    <header className="top-bar">
      <div className="brand">
        <div className="brand-pip" />
        <div>
          <div className="brand-title">Yakult GPT Payments</div>
          <div className="brand-tagline">80 PHP / month · due every 5th</div>
        </div>
      </div>

      <div className="user-pill">
        {user.photoURL && (
          <img
            src={user.photoURL}
            alt={user.displayName || user.email}
            className="user-avatar"
          />
        )}
        <div className="user-meta">
          <span className="user-name">
            {user.displayName || 'Yakult Friend'}
          </span>
          <span className="user-email">{user.email}</span>
        </div>
        {isAdmin && <span className="admin-badge">Admin</span>}
        <button className="pill-logout" onClick={onSignOut}>
          Log out
        </button>
      </div>
    </header>
  )
}

export default Header

