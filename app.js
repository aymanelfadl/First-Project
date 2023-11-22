const express = require('express');
const path = require('path');
const mysql = require('mysql');
const dotenv = require('dotenv');
const multer = require('multer');
const fs = require('fs');
const PDFDocument = require('pdfkit');

const app = express();
dotenv.config({
  path: 'config.env'
});

// Database connection setup
const con = mysql.createConnection({
  host: process.env.database_host,
  user: process.env.database_user,
  password: process.env.database_password,
  database: process.env.database
});

con.connect((error) => {
  if (error) {
    console.log(error);
  } else {
    console.log("Database connected");
  }
});

// Define the public directory and configure the app
const public_directory = path.join(__dirname, './Public');
app.use(express.static(public_directory));
app.set('view engine', 'hbs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Store uploaded files in the 'uploads' directory
  },
  filename: (req, file, cb) => {
    // Use 'path.extname' to get the file extension
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

let lusername;

// Define routes
app.get('/', (req, res) => {
  res.render('main'); // Assuming you have a "main" template
});

app.post("/main_page", (req, res) => {
  const lpassword = req.body.lpassword;
  lusername = req.body.lusername;

  con.query('SELECT username FROM users WHERE username = ? AND password = ?', [lusername, lpassword], (err, results) => {
    if (err) {
      console.log(err);
      // Handle the error, possibly return an error response
    } else if (results.length !== 0) {
      const sql = 'SELECT * FROM documents';
      con.query(sql, (err, results) => {
        if (err) {
          console.log(err);
          // Handle the error, possibly return an error response
        } else {
          res.render('main_page', { documents: results });
        }
      });
    } else {
      return res.render("main", {
        message: "INVALID USERNAME OR PASSWORD "
      });
    }
  });
});
app.get('/creating_acc', (req, res) => {
  // Render the registration form HTML here
  res.render("new");
});

app.post("/creating_acc", (req, res) => {
  const username = req.body.username;
  const password = req.body.password;
  const confirm_password = req.body.confirm_password;

  // Check if the username is already in use
  con.query('SELECT username FROM users WHERE username = ?', [username], (error, results) => {
    if (error) {
      console.log(error);
      // Handle the database error, possibly return an error response
      return res.render("new", {
        message: 'An error occurred while checking the username availability.'
      });
    }

    if (results.length > 0) {
      return res.render("new", {
        message: 'That username is already in use.'
      });
    }

    // Check if the password matches the confirm_password
    if (password !== confirm_password) {
      return res.render("new", {
        message: 'The password does not match the confirm password.'
      });
    }

    // If all checks pass, you can proceed to insert the new user into the database
    const newUser = {
      username: username,
      password: password // You should hash the password before storing it securely
    };

    con.query('INSERT INTO users SET ?', newUser, (insertError) => {
      if (insertError) {
        console.log(insertError);
        // Handle the database error, possibly return an error response
        return res.render("new", {
          message: 'An error occurred while creating the account.'
        });
      }

      // User successfully created
      return res.render("new", {
        message: 'Account created successfully.'
      });
    });
  });
});


app.post("/main_page/upload", upload.single('file'), async (req, res) => {
  try {
    const filename = req.body.filename;
    const fileReference = req.file.filename;

    const fileData = fs.readFileSync(req.file.path);
    const buffer = Buffer.from(fileData);

    await new Promise((resolve, reject) => {
      con.query(
        'INSERT INTO documents SET ?',
        { username: lusername, filename: filename, data: buffer },
        (error, results) => {
          if (error) {
            console.log(error);
            return reject(error);
          }
          resolve(results);
        }
      );
    });

    // After inserting the file, you can fetch the updated list of documents
    const sql = 'SELECT * FROM documents';
    const documents = await new Promise((resolve, reject) => {
      con.query(sql, (err, results) => {
        if (err) {
          console.log(err);
          return reject(err);
        }
        resolve(results);
      });
    });

    if (req.file) {
      res.render('main_page', { documents: documents, filename: filename });
    } else {
      res.render('main_page', { documents: documents });
    }
  } catch (error) {
    console.error(error);
  }
});

app.get('/download/:filename', (req, res) => {
  const filename = req.params.filename;
  console.log('Filename:', filename);

  // Assuming 'con' is your database connection object
  const sql = `SELECT data FROM documents WHERE filename = '${filename}'`;
  con.query(sql, (err, results) => {
    if (err) {
      console.error('Database error:', err);
      res.status(500).send('Internal Server Error');
      return;
    }

    if (results.length === 0) {
      res.status(404).send('File not found');
      return;
    }

    const fileData = results[0].data;

    // Set the Content-Disposition for download
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);

    // Set the Content-Type to "application/pdf"
    res.setHeader('Content-Type', 'application/pdf');

    // Send the binary PDF data to the client
    res.send(fileData);
  });
});

// Start the server on port 3069
app.listen(3069, () => {
  console.log("Listening on port 3069");
});
