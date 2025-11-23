5/10/2025: <br>
Arthur: Started by making the website template with a few placeholder features such as buttons, darkmode and a navbar. Also created the style.css and the WorkHistory.md file to keep a log of what was done by who and when. <br>

7/10/2025: <br>
Arthur: Installed the following onto the project: <br>
express: web server <br>
mongoose: MongoDB connector <br>
bcryptjs: for password hashing <br>
cors: allows your frontend to communicate with your backend <br>
dotenv: for hiding secrets like DB credentials <br>
<br>

8/10/2025: <br>
Arthur: Managed to get the login and register working with mongodb to create users, log in, log out and confirmed it still worked after stopping mongodb from running and turning off the live server and then turning it back on. (<br>)
Liam: Integrated Gemini API. Added chat system and worked on first level "Hex". <br>

9/10/25:<br>
Arthur:Discussed with group, how we're going to format the website. Created sketches of the Login, challenges, profile and leaderboards pages. Created branches on github to act as backups in case we commit something to main that breaks the page.

12/10/25:<br>
Arthur: Created the other main pages that we discussed our website needed (challenges, leaderboard, login and profile). I then made the navbar a javascript file so it's easier to include in every page and if I need to change something it gets changed in every page. Made the login page so that users need to login or register if they want to access the website. Made the ten challenges in a folder so it's quick and easy to locate and wont cause clutter in the "Website" folder. Made the profile page with a few placeholder features and an achievements drawer with placeholder badges, however its a little bit buggy and broken at the moment so it will have to be fixed later.

13/10/25:<br>
Arthur: fixed small bug on the navbar where you'd get a "Cannot GET" reply when you try and use the navbar buttons in challenges 2-10.

15/10/25:<br>
Arthur: added the change profile button and remove profile button on the profile.html page. Added a little icon next to your user on the navbar. Added 9 placeholder profile pictures (1024 x 1024). Added the streaks function to the profile as well.

21/10/25:
Jhon: MY COMMENT WASNT SAVED WHEN I MERGED MY BRANCH WITH THE MAIN BRANCH || Made most of the integration changes with the backend and frontend, added endpoints in the server.js file for this integration change, and modified relevant files to fetch data from the backend server instead of relying on calling on local storage, most recent changes as of 21/10/25 center around front-end integration in the challenge_selection and profile html files so that completed challenges reflect appropriately.

24/10/25:
Arthur: Made the "Lets Go" button work on the home page, takes you to the next level available to the user. Fixed the email on the register to ensure it validates if an input is an email. Added a previous and next level button to each level. fixed the dark mode on profile page (streak colour bubbles and the change profile picture window). made the navbar highlight depending on what page you're on. changed the darkmode toggle to be a sun and moon. Added a number tracker to the streaks for cases over 7 days.

27/10/25:
Added functioning logic for Forum Pages for each challenge, no styling has been made, and bug where text color on forums dont update upon dark mode.

28/10/25:<br>
Arthur: Fixed up the forums to have styling and ensured compatability with dark mode. Also made the points stand out a little more on each of the challenge pages. Fixed bug on random challenge where the point system was bugged and not working as intended (or working at all).

28/10/25:<br>
Jhon: Fixed placeholders for resetting passwords and verifying emails, import new modules (nodemailer and jsonwebtoken) as well as replace old .env file with the new one, current accouns you have access to need to be removed and remade so that they have the current userschema. 