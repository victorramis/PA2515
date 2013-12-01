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
    public class OrderDTO
    {
        public OrderDTO(Order baseOrder)
        {
            this.OrderId = baseOrder.OrderId;
            this.DateCreated = baseOrder.DateCreated;
            this.DateDelivered = baseOrder.DateDelivered;
            this.DateConfirmed = baseOrder.DateConfirmed;
            this.IsConfirmed = baseOrder.IsConfirmed;
            this.IsDelivered = baseOrder.IsDelivered;
            this.User = baseOrder.User;
        }
        public int OrderId { get; set; }
        public DateTime DateCreated { get; set; }
        public DateTime DateDelivered { get; set; }
        public DateTime DateConfirmed { get; set; }
        public bool IsConfirmed { get; set; }
        public bool IsDelivered { get; set; }
        public UserProfile User { get; set; }
        public IList<OrderItemDTO> OrderItems { get; set; }
    }
}