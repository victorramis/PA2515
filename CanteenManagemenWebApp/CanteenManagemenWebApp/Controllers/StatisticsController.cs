using System;
using System.Collections.Generic;
using System.Data;
using System.Data.Entity;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using CanteenManagemenWebApp.Models;

namespace CanteenManagemenWebApp.Controllers
{
    public class StatisticsController : Controller
    {
        private CanteenContext db = new CanteenContext();

        //
        // GET: /Statistics/

        public ActionResult Index()
        {
            Statistics statistics = new Statistics();
            var today = new DateTime();
            //var dayOrders = new List<Order>();
            //var monthOrders = new List<Order>(); 
            //var fullOrderDay = new List<OrderDTO>(); 
            //var fullOrderMonth = new List<OrderDTO>(); 
            using (CanteenContext ctx = new CanteenContext())
            {

                statistics.TotalNumberOfUsers = (from o in ctx.UserProfiles select o).Count();
                statistics.TotalNumberOfOrders = (from o in ctx.OrderItems select o).Count();
                statistics.TotalSalesToday = (from o in ctx.Orders where o.IsDelivered == true && o.DateDelivered.Day == today.Day select o).Count();
                statistics.TotalSalesThisMonth = (from o in ctx.Orders where o.IsDelivered == true && o.DateDelivered.Month == today.Month select o).Count();

                var dayOrders = (from o in ctx.Orders where o.IsDelivered == true && o.DateDelivered.Day == today.Day select o).ToList();
                var monthOrders = (from o in ctx.Orders where o.IsDelivered == true && o.DateDelivered.Month == today.Month select o).ToList();

                var orderItemsDay = new List<OrderItemDTO>();
                var orderItemsMonth = new List<OrderItemDTO>();
                var orderItemsDayFull = new List<OrderItem>();
                var orderItemsMonthFull = new List<OrderItem>();
                var fullOrderDay = new List<OrderDTO>();
                var fullOrderMonth = new List<OrderDTO>();

                foreach (var i in dayOrders)
                {
                    fullOrderDay.Add(new OrderDTO(i));
                }
                foreach (var i in monthOrders)
                {
                    fullOrderMonth.Add(new OrderDTO(i));
                }

                foreach (var i in fullOrderDay)
                {
                    orderItemsDayFull = (from o in ctx.OrderItems orderby o.OrderItemId where o.OrderId == i.OrderId select o).ToList();
                }
                foreach (var i in fullOrderMonth)
                {
                    orderItemsMonthFull = (from o in ctx.OrderItems orderby o.OrderItemId where o.OrderId == i.OrderId select o).ToList();
                }

                foreach (var i in orderItemsDayFull)
                {
                    var menuItem = (from o in ctx.MenuItems orderby o.MenuItemId where o.MenuItemId == i.MenuItemId select o).ToList().FirstOrDefault();
                    var orderX = new OrderItemDTO(i);
                    orderX.MenuItem = menuItem;
                    if (menuItem != null)
                    {
                        orderItemsDay.Add(orderX);
                    }
                }
                foreach (var i in orderItemsMonthFull)
                {
                    var menuItem = (from o in ctx.MenuItems orderby o.MenuItemId where o.MenuItemId == i.MenuItemId select o).ToList().FirstOrDefault();
                    var orderX = new OrderItemDTO(i);
                    orderX.MenuItem = menuItem;
                    if (menuItem != null)
                    {
                        orderItemsMonth.Add(orderX);
                    }
                }

                if (orderItemsDay.Count > 0)
                {
                    foreach (var i in orderItemsDay)
                    {

                    }
                }



                //db.Statistics.Add(statistics);
                //db.SaveChanges();

            }
            return View("Details", statistics);
        }

        //
        // GET: /Statistics/Details/5

        public ActionResult Details(int id = 0)
        {
            Statistics statistics = db.Statistics.Find(id);
            if (statistics == null)
            {
                return HttpNotFound();
            }
            return View(statistics);
        }

        //
        // GET: /Statistics/Create

        public ActionResult Create()
        {
            return View();
        }

        //
        // POST: /Statistics/Create

        [HttpPost]
        public ActionResult Create(Statistics statistics)
        {
            if (ModelState.IsValid)
            {
                db.Statistics.Add(statistics);
                db.SaveChanges();
                return RedirectToAction("Index");
            }

            return View(statistics);
        }

        //
        // GET: /Statistics/Edit/5

        public ActionResult Edit(int id = 0)
        {
            Statistics statistics = db.Statistics.Find(id);
            if (statistics == null)
            {
                return HttpNotFound();
            }
            return View(statistics);
        }

        //
        // POST: /Statistics/Edit/5

        [HttpPost]
        public ActionResult Edit(Statistics statistics)
        {
            if (ModelState.IsValid)
            {
                db.Entry(statistics).State = EntityState.Modified;
                db.SaveChanges();
                return RedirectToAction("Index");
            }
            return View(statistics);
        }

        //
        // GET: /Statistics/Delete/5

        public ActionResult Delete(int id = 0)
        {
            Statistics statistics = db.Statistics.Find(id);
            if (statistics == null)
            {
                return HttpNotFound();
            }
            return View(statistics);
        }

        //
        // POST: /Statistics/Delete/5

        [HttpPost, ActionName("Delete")]
        public ActionResult DeleteConfirmed(int id)
        {
            Statistics statistics = db.Statistics.Find(id);
            db.Statistics.Remove(statistics);
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