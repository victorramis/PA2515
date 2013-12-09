using CanteenManagemenWebApp.Models;
using System;
using System.Collections.Generic;
using System.Data.Entity.Infrastructure;
using System.Data.Entity;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using WebMatrix.WebData;
using System.Web.Security;

namespace CanteenManagemenWebApp.Controllers
{
    public class BaseController : Controller
    {
        public BaseController()
        {
            InitSimpleMembership();
        }

        public void InitSimpleMembership()
        {
            WebSecurityInitializer.Instance.EnsureInitialize();
        }
        public static bool IsInAnyRole(UserProfile user, params string[] roles)
        {
            var inRoles = Roles.GetRolesForUser(user.UserName);
            foreach (var role in roles)
            {
                if (inRoles.Contains(role))
                {
                    return true;
                }
            }

            return false;
        }
    }


    // Call this with WebSecurityInitializer.Instance.EnsureInitialize()
    public class WebSecurityInitializer
    {
        private WebSecurityInitializer() { }
        public static readonly WebSecurityInitializer Instance = new WebSecurityInitializer();
        private bool isNotInit = true;
        private readonly object SyncRoot = new object();
        public void EnsureInitialize()
        {
            if (isNotInit)
            {
                lock (this.SyncRoot)
                {
                    if (isNotInit)
                    {
                        isNotInit = false;
                        WebSecurity.InitializeDatabaseConnection("CanteenConnection",
                            userTableName: "UserProfile", userIdColumn: "UserId", userNameColumn: "UserName",
                            autoCreateTables: true);
                    }
                }
            }
        }
    }
}

