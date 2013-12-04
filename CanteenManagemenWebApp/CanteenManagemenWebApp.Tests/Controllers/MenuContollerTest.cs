using System;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using CanteenManagemenWebApp;
using CanteenManagemenWebApp.Controllers;
using System.Web.Mvc;

namespace CanteenManagemenWebApp.Tests.Controllers
{
    [TestClass]
    public class MenuContollerTest
    {
        [TestMethod]
        public void CreateShouldReturnView()
        {
            MenuController menuController = new MenuController();
            ViewResult viewResult=  menuController.Create() as ViewResult;
            Assert.IsNotNull(viewResult);
        }
    }
}
