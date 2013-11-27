using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Web;

namespace CanteenManagemenWebApp.Models
{
    public class Order
    {

        [Key]
        [DatabaseGeneratedAttribute(DatabaseGeneratedOption.Identity)]
        public int OrderId { get; set; }
        public DateTime DateCreated { get; set; }
        public DateTime DateDelivered { get; set; }
        public DateTime DateConfirmed { get; set; }
        public bool IsConfirmed { get; set; }
        public bool IsDelivered { get; set; }
        public UserProfile User { get; set; }
    }
}