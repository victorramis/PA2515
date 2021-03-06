﻿using System;
using System.Collections.Generic;
using System.Data;
using System.Data.Entity;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using CanteenManagemenWebApp.Models;
using System.Web.Security;
using WebMatrix.WebData;

namespace CanteenManagemenWebApp.Controllers
{
    [Authorize]
    public class OrderController : Controller
    {
        public OrderController() : base() { }
        private CanteenContext db = new CanteenContext();

        //
        // GET: /Order/
        [Authorize(Roles = "Manager, Employee")]
        public ActionResult Index()
        {
            var orders = db.Orders.ToList();
            var fullOrders = new List<OrderDTO>();

            foreach (var order in orders)
            {
                var fullOrder = new OrderDTO(order);
                var orderItems = new List<OrderItemDTO>();
                using (CanteenContext ctx = new CanteenContext())
                {
                    var orderItemsFull = (from o in ctx.OrderItems orderby o.OrderItemId where o.OrderId == fullOrder.OrderId select o).ToList();
                    foreach (var i in orderItemsFull)
                    {
                        var menuItem = (from o in ctx.MenuItems orderby o.MenuItemId where o.MenuItemId == i.MenuItemId select o).ToList().FirstOrDefault();
                        var orderX = new OrderItemDTO(i);
                        orderX.MenuItem = menuItem;
                        if (menuItem != null)
                            orderItems.Add(orderX);
                    }

                }
                fullOrder.OrderItems = orderItems;
                if (fullOrder.OrderItems.Count() > 0)
                    fullOrders.Add(fullOrder);
            }
            return View(fullOrders);
        }
        public ActionResult IndexEmployee() 
        {


            var orders = new List<Order>();
            var fullOrders = new List<OrderDTO>();
            using (CanteenContext ctx = new CanteenContext())
            {
                orders = (from o in ctx.Orders.Include("User") orderby o.OrderId where o.IsDelivered == false && o.User.Blocked == false select o).ToList();
            }

            foreach (var order in orders)
            {
                var fullOrder = new OrderDTO(order);
                var orderItems = new List<OrderItemDTO>();
                if (order.User != null)
                    fullOrders.Add(fullOrder);
            }
            return View("IndexEmployee", fullOrders);
        }
        [Authorize]
        public ActionResult IndexCustomer()
        {
            var user = new UserProfile();
            using (CanteenContext ctx = new CanteenContext())
            {
                user = (from o in ctx.UserProfiles orderby o.UserId where o.UserName == User.Identity.Name select o).ToList().FirstOrDefault();
            }
            var orders = new List<Order>();

            using (CanteenContext ctx = new CanteenContext())
            {
                orders = (from o in ctx.Orders.Include("User") orderby o.OrderId where o.User.UserId == user.UserId select o).ToList();
            }
            var fullOrders = new List<OrderDTO>();

            foreach (var order in orders)
            {
                var fullOrder = new OrderDTO(order);
                var orderItems = new List<OrderItemDTO>();
                using (CanteenContext ctx = new CanteenContext())
                {
                    var orderItemsFull = (from o in ctx.OrderItems orderby o.OrderItemId where o.OrderId == fullOrder.OrderId select o).ToList();
                    foreach (var i in orderItemsFull)
                    {
                        var menuItem = (from o in ctx.MenuItems orderby o.MenuItemId where o.MenuItemId == i.MenuItemId select o).ToList().FirstOrDefault();
                        var orderX = new OrderItemDTO(i);
                        orderX.MenuItem = menuItem;
                        if (menuItem != null)
                            orderItems.Add(orderX);
                    }

                }
                fullOrder.OrderItems = orderItems;
                if (fullOrder.OrderItems.Count() > 0)
                    fullOrders.Add(fullOrder);
            }
            return View(fullOrders);
        }
        public ActionResult IndexCustomerActive()
        {
            var user = new UserProfile();
            using (CanteenContext ctx = new CanteenContext())
            {
                user = (from o in ctx.UserProfiles orderby o.UserId where o.UserName == User.Identity.Name select o).ToList().FirstOrDefault();
            }
            var orders = new List<Order>();

            using (CanteenContext ctx = new CanteenContext())
            {
                orders = (from o in ctx.Orders.Include("User") orderby o.OrderId where o.User.UserId == user.UserId && o.IsDelivered == false select o).ToList();
            }
            var fullOrders = new List<OrderDTO>();

            foreach (var order in orders)
            {
                var fullOrder = new OrderDTO(order);
                var orderItems = new List<OrderItemDTO>();
                using (CanteenContext ctx = new CanteenContext())
                {
                    var orderItemsFull = (from o in ctx.OrderItems orderby o.OrderItemId where o.OrderId == fullOrder.OrderId select o).ToList();
                    foreach (var i in orderItemsFull)
                    {
                        var menuItem = (from o in ctx.MenuItems orderby o.MenuItemId where o.MenuItemId == i.MenuItemId select o).ToList().FirstOrDefault();
                        var orderX = new OrderItemDTO(i);
                        orderX.MenuItem = menuItem;
                        if (menuItem != null)
                            orderItems.Add(orderX);
                    }

                }
                fullOrder.OrderItems = orderItems;
                if (fullOrder.OrderItems.Count() > 0)
                    fullOrders.Add(fullOrder);
            }
            return View("IndexCustomer", fullOrders);
        }

        //
        // GET: /Order/Details/5

        public ActionResult Details(int id = 0)
        {
            Order order = db.Orders.Find(id);
            if (order == null)
            {
                return HttpNotFound();
            }
            return View(order);
        }

        //
        // GET: /Order/Create

        public ActionResult Create()
        {
            return View();
        }

        //
        // POST: /Order/Create

        [HttpPost]
        public ActionResult Create(Order order)
        {
            if (ModelState.IsValid)
            {
                db.Orders.Add(order);
                db.SaveChanges();
                return RedirectToAction("Index");
            }

            return View(order);
        }

        //
        // GET: /Order/Edit/5

        public ActionResult Edit(int id = 0)
        {
            Order order = db.Orders.Find(id);
            if (order == null)
            {
                return HttpNotFound();
            }
            return View(order);
        }
        public ActionResult EditEmployee(int id = 0)
        {
            Order order = db.Orders.Find(id);   
            
            if (order == null)
            {
                return HttpNotFound();
            }
            var fullOrder = new OrderDTO(order);
            
            var orderItems = new List<OrderItemDTO>();
            var orderItemsSorted = new List<OrderItemDTO>();
            using (CanteenContext ctx = new CanteenContext())
            {
                var orderItemsFull = (from o in ctx.OrderItems orderby o.OrderItemId where o.OrderId == fullOrder.OrderId select o).ToList();
                foreach (var i in orderItemsFull)
                {
                    var menuItem = (from o in ctx.MenuItems orderby o.MenuItemId where o.MenuItemId == i.MenuItemId select o).ToList().FirstOrDefault();
                    var orderX = new OrderItemDTO(i);
                    orderX.MenuItem = menuItem;
                    if (menuItem != null)
                    {
                        orderItems.Add(orderX); 
                    }
                }

            }
            if (orderItems.Count > 0)
            {

                fullOrder.OrderItems = orderItems.OrderBy(o => o.MenuItemId).ToList();
                
            }   
            return View(fullOrder);
            /* orig
            Order order = db.Orders.Find(id);
            if (order == null)
            {
                return HttpNotFound();
            }
       
            return View(order);*/
        }

        //
        // POST: /Order/Edit/5

        [HttpPost]
        public ActionResult Edit(Order order)
        {
            if (ModelState.IsValid)
            {
                db.Entry(order).State = EntityState.Modified;
                db.SaveChanges();
                return RedirectToAction("Index");
            }
            return View(order);
        }
        [HttpPost]
        public ActionResult EditEmployee(Order order)
        {
            if (ModelState.IsValid)
            {
                var fullOrder = db.Orders.Find(order.OrderId);
                if (order.IsConfirmed == true && fullOrder.IsConfirmed == false)
                {
                    order.DateConfirmed = DateTime.Now;

                }
                else
                {
                    order.DateConfirmed = fullOrder.DateConfirmed; 
                }
                if (order.IsDelivered == true && fullOrder.IsDelivered == false)
                {
                    order.DateDelivered = DateTime.Now;

                }
                else
                {
                    order.DateDelivered = fullOrder.DateDelivered;
                }
                order.DateCreated = fullOrder.DateCreated;
                db.Entry(fullOrder).State = EntityState.Detached;
                db.Entry(order).State = EntityState.Modified;
                db.SaveChanges();
                return RedirectToAction("IndexEmployee");
            }
            return View(order);
        }

        //
        // GET: /Order/Delete/5

        public ActionResult Delete(int id = 0)
        {
            Order order = db.Orders.Find(id);
            if (order == null)
            {
                return HttpNotFound();
            }
            return View(order);
        }

        public ActionResult BlockUser(int id = 0)
        {
            UserProfile user = db.UserProfiles.Find(id);
            if (user == null)
            {
                return HttpNotFound();
            }
            user.Blocked = true;
            db.SaveChanges();

            return RedirectToAction("IndexEmployee");
        }

        //
        // POST: /Order/Delete/5

        [HttpPost, ActionName("Delete")]
        public ActionResult DeleteConfirmed(int id)
        {
            Order order = db.Orders.Find(id);
            db.Orders.Remove(order);
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