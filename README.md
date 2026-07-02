# SwapNest – Peer-to-Peer Campus Lending Platform

SwapNest is a full-stack MERN application that enables students to lend and borrow items within their college community. It provides secure authentication, real-time messaging, online payments, and order management to make campus item sharing simple and reliable.

## Features

* Secure user authentication using JWT
* List, edit, and manage products
* Browse and search available items
* Real-time chat between borrowers and lenders using Socket.IO
* Wishlist management
* Secure online payments with Razorpay
* Order and transaction history
* Image upload and storage using Cloudinary
* Responsive user interface for desktop and mobile

## Tech Stack

**Frontend**

* React (Vite)
* React Router
* Axios
* CSS

**Backend**

* Node.js
* Express.js
* MongoDB
* Mongoose
* Socket.IO
* JWT Authentication
* bcrypt
* Razorpay
* Cloudinary

## Project Structure

```text
swapnest
│
├── backend
│   ├── controllers
│   ├── middleware
│   ├── models
│   ├── routes
│   ├── config
│   ├── sockets
│   └── server.js
│
└── frontend
    ├── src
    │   ├── components
    │   ├── pages
    │   ├── context
    │   ├── api
    │   └── assets
    └── public
```

## How It Works

1. Users create an account and log in securely.
2. Lenders list items with images and details.
3. Borrowers browse or search for available items.
4. Users communicate instantly through real-time chat.
5. Borrowers complete secure payments using Razorpay.
6. Orders and lending history are updated automatically.

## Installation

### Backend

```bash
cd backend
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Configure the required environment variables in the `.env` file before running the project.

## Future Improvements

* Product ratings and reviews
* Email notifications
* AI-based product recommendations
* Location-based item discovery
* Admin dashboard

## Screenshots

You can add screenshots of:

* Home Page
* Product Listing
* Product Details
* Chat Page
* Wishlist
* Checkout
* Orders

## License

This project is developed for educational and learning purposes.