using CanteenManagemenWebApp.Models;
using System;
using System.Collections.Generic;
using System.Data.Entity.Infrastructure;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using WebMatrix.WebData;
using System.Data.Entity;
using System.Data.Entity.Infrastructure;

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

