using System;
using System.Collections.Generic;
using System.Data;
using System.Data.Entity;
using System.Data.Entity.Infrastructure;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Web;
using System.Web.Http;
using CanteenManagemenWebApp.Models;

namespace CanteenManagemenWebApp.Controllers
{
    [Authorize]
    public class OrderApiController : ApiController
    {
        private CanteenContext db = new CanteenContext();

        // GET api/Default1
        public IEnumerable<Order> GetOrders()
        {
            return db.Orders.AsEnumerable();
        }

        // GET api/Default1/5
        public Order GetOrder(int id)
        {
            Order order = db.Orders.Find(id);
            if (order == null)
            {
                throw new HttpResponseException(Request.CreateResponse(HttpStatusCode.NotFound));
            }

            return order;
        }

        // PUT api/Default1/5
        public HttpResponseMessage PutOrder(int id, Order order)
        {
            if (ModelState.IsValid && id == order.OrderId)
            {
                db.Entry(order).State = EntityState.Modified;

                try
                {
                    db.SaveChanges();
                }
                catch (DbUpdateConcurrencyException)
                {
                    return Request.CreateResponse(HttpStatusCode.NotFound);
                }

                return Request.CreateResponse(HttpStatusCode.OK);
            }
            else
            {
                return Request.CreateResponse(HttpStatusCode.BadRequest);
            }
        }

        // POST api/Default1
        public HttpResponseMessage PostOrder(IList<CartItem> cartItems)
        {
            if (ModelState.IsValid)
            {
                var user = new UserProfile();
                using (CanteenContext ctx = new CanteenContext())
                {
                    user = (from o in ctx.UserProfiles orderby o.UserId where o.UserName == User.Identity.Name select o).ToList().FirstOrDefault();
                }
                db.Entry(user).State = EntityState.Unchanged;
                var order = new Order()
                {
                    DateConfirmed = DateTime.Today,
                    DateCreated = DateTime.Today,
                    DateDelivered = DateTime.Today,
                    IsConfirmed = false,
                    IsDelivered = false,
                    User = user
                };
                db.Orders.Add(order);
                db.SaveChanges();

                foreach (var i in cartItems)
                {
                    var orderItem = new OrderItem()
                    {
                        MenuItemId = i.Id,
                        OrderId = order.OrderId
                    };

                    db.OrderItems.Add(orderItem);
                }


                db.SaveChanges();

                HttpResponseMessage response = Request.CreateResponse(HttpStatusCode.Created, cartItems);
                return response;
            }
            else
            {
                return Request.CreateResponse(HttpStatusCode.BadRequest);
            }
        }

        // DELETE api/Default1/5
        public HttpResponseMessage DeleteOrder(int id)
        {
            Order order = db.Orders.Find(id);
            if (order == null)
            {
                return Request.CreateResponse(HttpStatusCode.NotFound);
            }

            db.Orders.Remove(order);

            try
            {
                db.SaveChanges();
            }
            catch (DbUpdateConcurrencyException)
            {
                return Request.CreateResponse(HttpStatusCode.NotFound);
            }

            return Request.CreateResponse(HttpStatusCode.OK, order);
        }

        protected override void Dispose(bool disposing)
        {
            db.Dispose();
            base.Dispose(disposing);
        }
    }
}