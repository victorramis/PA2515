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
            using (CanteenContext ctx = new CanteenContext())
            {

                statistics.TotalNumberOfUsers = (from o in ctx.UserProfiles select o).Count();
                statistics.TotalNumberOfOrders = (from o in ctx.OrderItems select o).Count();
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