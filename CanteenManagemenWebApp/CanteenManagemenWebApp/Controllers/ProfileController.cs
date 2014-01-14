using System;
using System.Collections.Generic;
using System.Data;
using System.Data.Entity;
using System.Linq; 
using System.Web;
using System.Web.Mvc;
using CanteenManagemenWebApp.Models;
using System.Web.Security;

namespace CanteenManagemenWebApp.Controllers
{
    [Authorize]
    public class ProfileController : Controller
    {
        private CanteenContext db = new CanteenContext();

        //
        // GET: /Profile/

        public ActionResult Index()
        {

            var users = db.UserProfiles.ToList();
            var usersWithRoles = new List<UserProfileDTO>();
            foreach ( var item in users ){
                var userProfileDTO = new UserProfileDTO(item);
                userProfileDTO.RoleName = Roles.GetRolesForUser(item.UserName).FirstOrDefault(); 

                usersWithRoles.Add(userProfileDTO);
            }
             

            return View(usersWithRoles);
        }

        //
        // GET: /Profile/Details/5

        public ActionResult Details(int id)
        {
            UserProfile userprofile = db.UserProfiles.Find(id);
            if (userprofile == null)
            {
                return HttpNotFound();
            }
            return View(userprofile);
        }
        public ActionResult MyDetails()
        {

            var userprofile = new UserProfile();
            using (CanteenContext ctx = new CanteenContext())
            {
                userprofile = (from o in ctx.UserProfiles orderby o.UserId where o.UserName == User.Identity.Name select o).ToList().FirstOrDefault();
            }
            if (userprofile == null)
            {
                return HttpNotFound();
            }
            return View(userprofile);
        }
        public ActionResult IndexCustomer()
        {
            var users = new List<UserProfile>();
            var usersDTO = new List<UserProfileDTO>();
            using (CanteenContext ctx = new CanteenContext())
            {
                var usernames = Roles.GetUsersInRole("Client"); 
                 foreach (var user in usernames)
                { 
                
                var userprofile = (from o in ctx.UserProfiles where o.UserName == user select o).ToList().FirstOrDefault();
                if (userprofile != null) {
                    usersDTO.Add(new UserProfileDTO( userprofile));
                }
                }


               

            }
            return View("Index",usersDTO);
            
        }

        //
        // GET: /Profile/Create
        private UserProfile _getCurrentUser()
        {
            var userprofile = new UserProfile();
            using (CanteenContext ctx = new CanteenContext())
            {
                userprofile = (from o in ctx.UserProfiles orderby o.UserId where o.UserName == User.Identity.Name select o).ToList().FirstOrDefault();
            }
            return userprofile;
        }

        private void _addToRole(UserProfile user, string roleName)
        {
            var roles = new string[] { "Employee", "Client", "Manager" };
            if (!Roles.RoleExists(roleName))
            {
                Roles.CreateRole(roleName);
            }
            var inRoles = Roles.GetRolesForUser(user.UserName);
            foreach (var role in roles)
            {
                if (inRoles.Contains(role))
                {
                    Roles.RemoveUserFromRole(user.UserName, role);
                }
            }
            Roles.AddUserToRole(user.UserName, roleName);


        }
        public ActionResult Create()
        {
            return View();
        }

        public ActionResult MakeMeManager()
        {
            var role = "Manager";
            var user = _getCurrentUser();
            _addToRole(user, role);
            return View("MakeMe", user);
        }

        public ActionResult MakeMeEmployee()
        {
            var role = "Employee";
            var user = _getCurrentUser();
            _addToRole(user, role);
            return View("MakeMe", user);
        }

        public ActionResult MakeMeClient()
        {
            var role = "Client";
            var user = _getCurrentUser();
            _addToRole(user, role);
            return View("MakeMe", user);
        }

        //
        // POST: /Profile/Create

        [HttpPost]
        public ActionResult Create(UserProfile userprofile)
        {
            if (ModelState.IsValid)
            {
                db.UserProfiles.Add(userprofile);
                db.SaveChanges();
                return RedirectToAction("Index");
            }

            return View(userprofile);
        }

        //
        // GET: /Profile/Edit/5

        public ActionResult Edit(int id = 0)
        {
            UserProfile userprofile = db.UserProfiles.Find(id);
            if (userprofile == null)
            {
                return HttpNotFound();
            }
            return View(userprofile);
        }

        //
        // POST: /Profile/Edit/5

        [HttpPost]
        public ActionResult Edit(UserProfile userprofile)
        {
            if (ModelState.IsValid)
            {
                db.Entry(userprofile).State = EntityState.Modified;
                db.SaveChanges();
                return RedirectToAction("MyDetails");
            }
            return View(userprofile);
        }

        //
        // GET: /Profile/Delete/5

        public ActionResult Delete(int id = 0)
        {
            UserProfile userprofile = db.UserProfiles.Find(id);
            if (userprofile == null)
            {
                return HttpNotFound();
            }
            return View(userprofile);
        }

        //
        // POST: /Profile/Delete/5

        [HttpPost, ActionName("Delete")]
        public ActionResult DeleteConfirmed(int id)
        {
            UserProfile userprofile = db.UserProfiles.Find(id);
            db.UserProfiles.Remove(userprofile);
            db.SaveChanges();
            return RedirectToAction("Index");
        }

        protected override void Dispose(bool disposing)
        {
            db.Dispose();
            base.Dispose(disposing);
        }
    }
}