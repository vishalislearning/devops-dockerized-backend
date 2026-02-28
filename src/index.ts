import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import type { NextFunction, Request, Response } from "express";
import cookieparser from "cookie-parser";
import User from "./models/user.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import multer from "multer";
import { imagekit } from "./imagekit.js";
import { Post } from "./models/post.js";
import "dotenv/config";

const upload = multer({storage: multer.memoryStorage()});
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

app.set("view engine","ejs");
app.use(express.json());
app.use(express.urlencoded({ extended:true}))
app.use(express.static(path.join(__dirname,"public")));
app.use(cookieparser());
app.use((req, res, next) => {
  res.locals.success = typeof req.query.success === "string"
    ? req.query.success
    : null;

  res.locals.error = typeof req.query.error === "string"
    ? req.query.error
    : null;

  next();
});


app.get("/", (req: Request, res: Response) => {
  res.redirect('/feed');
});
  
  /////////////// create user page////////////
app.get("/create", (req: Request, res: Response) => {
  res.render("index");
});

app.post("/create",(req: Request, res: Response) => {
  let {username, email, password, age} = req.body;
  
    bcrypt.genSalt(10, (err, salt) => {
      bcrypt.hash(password, salt, async (err, hash) => {
        let createdUser = await User.create({
          username,
          email,
          password: hash,
          age
        })
        
        const token = jwt.sign({
          email: email
        },process.env.JWT_SECRET as string);

        res.cookie("token",token)
        res.redirect('/feed?success=Successfully created user ')
      })
    });
});

/////////////// logout user //////////
app.get("/logout", function(req,res){
  res.cookie("token",String(""))
  res.redirect("/?success=logout successful");  
})

//////// login user//////////
app.get("/login", function(err, result){
    result.render('login');
});

app.post("/login", async function (req, res) {
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    return res.redirect("/login?error=Invalid credentials");
  }

  bcrypt.compare(req.body.password, String(user.password), function (err, result) {

    if (!result) {
      return res.redirect("/login?error=Invalid credentials");
    }

    const token = jwt.sign(
      { email: user.email },
      process.env.JWT_SECRET as string
    );

    res.cookie("token", token, { httpOnly: true });

    return res.redirect("/feed?success=Successfully logged in ");
  });
});

//////////////feed//////////////
app.get("/feed", async function(req, res) {
  const token = req.cookies.token;
  let user = null;

  const posts = await Post.find().lean();

  if (token) {
    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET as string
      ) as { email: string };

      user = await User.findOne({ email: decoded.email })
        .select("username email")
        .lean();

    } catch (err) {
      user = null;
    }
  }

  res.render("feed", { posts, user });
});

/////////create post///////////
app.get("/post",(req,res) => {
  res.render('post')
})
app.post("/post", upload.single("image"), async (req, res) => {
  
  const token = req.cookies.token;
  const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { email: string };
  const user = await User.findOne({ email: decoded.email }).select("_id username");

  if (!user) return res.status(401).redirect("/feed?error=Unauthorized");
  if (!req.file) return res.status(400).redirect("/feed?error=no file uploaded");

  const result = await imagekit.upload({  
    file: req.file.buffer.toString("base64"),
    fileName: req.file.originalname,
    folder: "/posts",
    useUniqueFileName: true,
  });

  const post = await Post.create({
    imageUrl: result.url,
    createdBy: user._id,
    username: String(user.username),
    description: req.body.description
  });

   res.redirect("/feed?success=post created");
});

/////////// delete post////////
app.post('/delete/:id', async (req, res) => {

  try {
    const token = req.cookies.token;
     if (!token) {
      return res.redirect("/feed?error=please login first");
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { email: string };
    const user = await User.findOne({ email: decoded.email }).select("_id");
    const post = await Post.findById(req.params.id);
    if (post?.createdBy.toString() != user?.id) {
     return res.redirect("/feed?error=you cannot delete this post");
    }else{
      await Post.findByIdAndDelete(req.params.id);
    res.redirect("/feed?success=post has been deleted");
    }  
  } catch (err) {
    res.status(500).send("Server error");
  }
});

/////////update post//////////
app.get('/edit/:id', async function (req, res) {
  try {
    const token = req.cookies.token;

    if (!token) {
      return res.redirect("/login?error=please login first");
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as { email: string };

    const user = await User.findOne({ email: decoded.email }).select("_id");

    if (!user) {
      return res.redirect("/feed?error=user not found");
    }

    const post = await Post.findById(req.params.id).lean();

    if (!post) {
      return res.redirect("/feed?error=Post not found");
    }

    if (post.createdBy.toString() !== user.id) {
      return res.redirect("/feed?error=You cannot edit this post");
    }

    return res.render("update", { post });

  } catch (error) {
    return res.status(500).json({ message: "Update failed" });
  }
});

app.post('/update/:id', upload.single("image"), async (req, res) => {
  
  try {
    const postid = req.params.id
   

    const updateData: any = {};

    if (req.body.description) {
      updateData.description = req.body.description;
    }

    if (req.file) {
      const result = await imagekit.upload({
        file: req.file.buffer.toString("base64"),
        fileName: `${Date.now()}-post.jpg`,
        folder: "/posts",
      });

      updateData.imageUrl = result.url;
    }

    const updatedPost = await Post.findByIdAndUpdate(
      postid,
      updateData,
      { new: true }
    );

  res.redirect("/feed?success=post has been edited");
  } catch (error) {
    return res.status(500).json({ message: "Update failed" });
  }
});

app.listen(3000);
